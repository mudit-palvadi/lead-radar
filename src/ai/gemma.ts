import type { BusinessLead, ClassificationResult, EmailDraft, LeadSignal } from '../types.js';
import { config } from '../config.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(prompt: string): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.groq.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

function extractJson(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function classifyLead(
  lead: Pick<BusinessLead, 'name' | 'address' | 'website' | 'rating' | 'reviewCount' | 'category'>,
  service: string,
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(lead, service);

  try {
    const parsed = extractJson(await callGroq(prompt)) as ClassificationResult | null;
    if (!parsed) {
      return { score: 50, signals: [], reasoning: 'Could not parse classification result.' };
    }
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      signals: Array.isArray(parsed.signals) ? (parsed.signals as LeadSignal[]) : [],
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch (error) {
    console.warn('Classification failed:', error instanceof Error ? error.message : error);
    return { score: 50, signals: [], reasoning: 'Classification unavailable.' };
  }
}

export async function draftOutreachEmail(
  lead: BusinessLead,
  service: string,
): Promise<EmailDraft> {
  const signalSummary = lead.signals
    .map((s) => `- ${s.description} (${s.severity})`)
    .join('\n');

  const prompt = `You are writing a personalized outreach email for a freelance ${service} provider.

Business: ${lead.name}
Location: ${lead.address}
${lead.website ? `Website: ${lead.website}` : 'No website found'}
Rating: ${lead.rating || 'N/A'} (${lead.reviewCount || 0} reviews)

Signals detected:
${signalSummary}

Write a short, personalized email (under 150 words) that:
1. References something specific about this business
2. Mentions the problem you noticed without being condescending
3. Offers a clear next step (call, meeting, or free audit)
4. Sounds human, not like a template

Return JSON with keys: subject, body, tone (one of: professional, friendly, direct)`;

  try {
    const parsed = extractJson(await callGroq(prompt)) as EmailDraft | null;
    if (!parsed) return fallbackEmail(lead, service);
    return {
      subject: String(parsed.subject || ''),
      body: String(parsed.body || ''),
      tone: parsed.tone ?? 'professional',
    };
  } catch (error) {
    console.warn('Email drafting failed:', error instanceof Error ? error.message : error);
    return fallbackEmail(lead, service);
  }
}

function fallbackEmail(lead: BusinessLead, service: string): EmailDraft {
  return {
    subject: `Helping ${lead.name} with ${service}`,
    body: `Hi ${lead.name} team,\n\nI came across your business while looking for ${service} clients in the area, and had a few ideas about how I could help. Would you be open to a quick 10-minute call this week?\n\nBest regards`,
    tone: 'professional',
  };
}

function buildClassificationPrompt(
  lead: Pick<BusinessLead, 'name' | 'address' | 'website' | 'rating' | 'reviewCount' | 'category'>,
  service: string,
): string {
  return `Classify how likely this business is to need ${service} services.

Business: ${lead.name}
Address: ${lead.address}
Category: ${lead.category || 'unknown'}
${lead.website ? `Website: ${lead.website}` : 'No website found'}
Google Rating: ${lead.rating || 'N/A'} (${lead.reviewCount || 0} reviews)

Rate 0-100 based on:
- Missing or outdated web presence
- Signs they serve customers but lack professional ${service}
- Negative reviews suggesting unmet needs
- No Google Business profile

Return JSON with keys: score, signals (array of {type, description, severity}), reasoning`;
}
