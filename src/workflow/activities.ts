import type { BusinessLead, ScanRequest } from '../types.js';
import { searchBusinesses } from '../search/serpapi.js';
import { classifyLead, draftOutreachEmail, identifyBusinessTypes } from '../ai/index.js';

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

  for (let i = 0; i < leads.length; i += 5) {
    const batch = leads.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((lead) => classifyLead(lead, service)),
    );

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        classified.push({
          ...batch[j],
          score: result.value.score,
          signals: [...batch[j].signals, ...result.value.signals],
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
): Promise<BusinessLead[]> {
  const topLeads = leads.slice(0, 10);
  const drafted: BusinessLead[] = [];

  for (let i = 0; i < topLeads.length; i += 3) {
    const batch = topLeads.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map((lead) => draftOutreachEmail(lead, service)),
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
