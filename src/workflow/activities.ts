import type { BusinessLead, LeadSignal, ScanRequest } from '../types.js';
import { searchBusinesses } from '../search/serpapi.js';
import { classifyLead, draftOutreachEmail, identifyBusinessTypes } from '../ai/index.js';

/**
 * The model is only allowed to report signals we can actually back up with
 * data we hold. We have a URL, not the page itself, so it can never know that
 * a website is dated — SerpApi signals are ground truth and pass through
 * untouched, but model claims are held to this list.
 */
const MODEL_VERIFIABLE_TYPES = new Set(['no_website', 'bad_reviews_no_response']);

/**
 * SerpApi and the model both report on the same problems, so merging naively
 * shows the user "No website found" three times. Keep the first report of each
 * distinct type, in severity order.
 */
export function mergeSignals(fromSearch: LeadSignal[], fromModel: LeadSignal[]): LeadSignal[] {
  const seen = new Set<string>();
  const merged: LeadSignal[] = [];

  // Small models vary the casing and padding of a type ("No_Website "), which
  // is enough to slip past a naive equality check.
  const normalize = (raw: unknown): string => String(raw ?? '').trim().toLowerCase();

  // Search signals are measured facts, so they pass through as-is.
  for (const signal of fromSearch) {
    const type = normalize(signal.type);
    if (!type || seen.has(type)) continue;
    seen.add(type);
    merged.push({ ...signal, type: type as LeadSignal['type'] });
  }

  // Model claims are held to what we can actually back up.
  for (const signal of fromModel) {
    const type = normalize(signal.type);
    if (!type || !MODEL_VERIFIABLE_TYPES.has(type) || seen.has(type)) continue;
    seen.add(type);
    merged.push({ ...signal, type: type as LeadSignal['type'] });
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  const severity = (s: LeadSignal) => rank[s.severity as keyof typeof rank] ?? 3;
  return merged.sort((a, b) => severity(a) - severity(b));
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
          score: result.value.score,
          signals: mergeSignals(batch[j].signals, result.value.signals),
        });
      } else {
        classified.push({
          ...batch[j],
          score: 0,
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
