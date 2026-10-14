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

export async function scanBusinesses(request: ScanRequest): Promise<BusinessLead[]> {
  const serviceWords = new Set(
    request.service.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  );

  // Drop any type that restates the freelancer's own trade (e.g. "web design",
  // "web design company") — those are competitors, not prospects.
  const types = (await identifyBusinessTypes(request.service)).filter((type) => {
    const words = type.split(/\s+/);
    return !words.some((w) => serviceWords.has(w));
  });

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
