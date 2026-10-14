import type { BusinessLead, LeadSignal, ScanRequest } from '../types.js';
import { searchBusinesses } from '../search/serpapi.js';
import { classifyLead, draftOutreachEmail, identifyBusinessTypes } from '../ai/index.js';

/**
 * SerpApi and the model both report on the same problems, so merging naively
 * shows the user "No website found" three times. Keep the first report of each
 * distinct type, in severity order.
 */
function mergeSignals(fromSearch: LeadSignal[], fromModel: LeadSignal[]): LeadSignal[] {
  const seen = new Set<string>();
  const merged: LeadSignal[] = [];

  for (const signal of [...fromSearch, ...fromModel]) {
    if (seen.has(signal.type)) continue;
    seen.add(signal.type);
    merged.push(signal);
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return merged.sort((a, b) => rank[a.severity] - rank[b.severity]);
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
