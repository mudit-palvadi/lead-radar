import type { BusinessLead, ScanRequest } from '../types.js';
import { searchBusinesses } from '../search/serpapi.js';
import { classifyLead, draftOutreachEmail, identifyBusinessTypes } from '../ai/index.js';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Signals are verified facts, so they carry most of the score. The model only
 * breaks ties: asked to score on its own it returned 70 for every lead, whether
 * or not the business had a website.
 */
export function scoreLead(lead: BusinessLead, modelScore: number): number {
  const has = (type: string) => lead.signals.some((s) => s.type === type);

  // Every local business is at least a possible client.
  let base = 30;
  if (has('no_website')) base += 55;
  if (has('bad_reviews_no_response')) base += 15;

  const blended = base * 0.75 + clamp(modelScore, 0, 100) * 0.25;
  return clamp(Math.round(blended), 0, 100);
}

/**
 * Drops business types that are the freelancer's own trade or close peers.
 * "design studio" does not contain the word "designer", so exact word matching
 * alone lets competitors through; prefix matching catches "design" inside
 * "designer". Agency and consultant roles never make good prospects for any
 * trade, but "studio" stays allowed because a yoga studio or recording studio
 * is a normal client.
 */
export function dropPeerTypes(types: string[], service: string): string[] {
  const serviceWords = new Set(
    service.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  );
  const peerWords = new Set([
    'agency',
    'agencies',
    'consultant',
    'consultants',
    'consulting',
    'consultancy',
    'freelance',
    'freelancer',
    'freelancers',
  ]);

  return types.filter((type) => {
    const words = type.split(/\s+/);
    const sameTrade = words.some(
      (w) =>
        serviceWords.has(w) ||
        (w.length >= 4 &&
          [...serviceWords].some(
            (sw) => sw.length >= 6 && (sw.startsWith(w) || w.startsWith(sw)),
          )),
    );
    return !sameTrade && !words.some((w) => peerWords.has(w));
  });
}

export async function scanBusinesses(request: ScanRequest): Promise<BusinessLead[]> {
  // Drop any type that restates or closely resembles the freelancer's own
  // trade (e.g. "web design", "design studio") — those are competitors, not
  // prospects.
  const types = dropPeerTypes(await identifyBusinessTypes(request.service), request.service);

  const query =
    types.length > 0
      ? `${types.join(' OR ')} in ${request.location}`
      : `${request.service} in ${request.location}`;

  console.log(`[scan] business types: ${types.length ? types.join(', ') : '(none - using raw service)'}`);
  console.log(`[scan] search query: ${query}`);

  const leads = await searchBusinesses(query, request.location, request.maxLeads);
  console.log(`[scan] serpapi returned ${leads.length} leads`);
  return leads;
}

export async function classifyLeads(
  leads: BusinessLead[],
  service: string,
): Promise<BusinessLead[]> {
  const classified: BusinessLead[] = [];

  // 3 keeps a batch inside the Groq free tier's per-minute token limit.
  for (let i = 0; i < leads.length; i += 3) {
    const batch = leads.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map((lead) => classifyLead(lead, service)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        classified.push({
          ...batch[j],
          score: scoreLead(batch[j], result.value.score),
          // Signals come straight from the search data and are never second-
          // guessed, so they can't contradict the record they sit beside.
          signals: batch[j].signals,
        });
      } else {
        classified.push({
          ...batch[j],
          // Model unavailable — fall back to the signal-derived score (a
          // neutral 50 for the model's 25% share) so the scan still returns
          // real, ranked leads instead of a dead end.
          score: scoreLead(batch[j], 50),
          signals: batch[j].signals,
        });
      }
    }
  }

  return classified.sort((a, b) => b.score - a.score);
}

export async function draftEmails(
  leads: BusinessLead[],
  service: string,
  senderName = 'Alex',
): Promise<BusinessLead[]> {
  const topLeads = leads.slice(0, 10);
  const drafted: BusinessLead[] = [];

  for (let i = 0; i < topLeads.length; i += 2) {
    const batch = topLeads.slice(i, i + 2);
    const results = await Promise.allSettled(
      batch.map((lead) => draftOutreachEmail(lead, service, senderName)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        drafted.push({
          ...batch[j],
          outreachEmail: `Subject: ${result.value.subject}\n\n${result.value.body}`,
        });
      } else {
        drafted.push(batch[j]);
      }
    }
  }

  return [...drafted, ...leads.slice(10)];
}
