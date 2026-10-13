import type { BusinessLead, ScanRequest } from '../types.js';
import { searchBusinesses } from '../search/serpapi.js';
import { classifyLead, draftOutreachEmail } from '../ai/gemma.js';

export async function scanBusinesses(request: ScanRequest): Promise<BusinessLead[]> {
  const leads = await searchBusinesses(
    request.service,
    request.location,
    request.maxLeads,
  );
  return leads;
}

export async function classifyLeads(
  leads: BusinessLead[],
  service: string,
): Promise<BusinessLead[]> {
  const classified: BusinessLead[] = [];

  for (const lead of leads) {
    const result = await classifyLead(lead, service);
    classified.push({
      ...lead,
      score: result.score,
      signals: [...lead.signals, ...result.signals],
    });
  }

  return classified.sort((a, b) => b.score - a.score);
}

export async function draftEmails(
  leads: BusinessLead[],
  service: string,
): Promise<BusinessLead[]> {
  const topLeads = leads.slice(0, 10);
  const drafted: BusinessLead[] = [];

  for (const lead of topLeads) {
    const email = await draftOutreachEmail(lead, service);
    drafted.push({
      ...lead,
      outreachEmail: `Subject: ${email.subject}\n\n${email.body}`,
    });
  }

  return [...drafted, ...leads.slice(10)];
}
