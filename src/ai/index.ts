import type { BusinessLead, ClassificationResult, EmailDraft, LeadSignal } from '../types.js';
import { config } from '../config.js';
import { GroqProvider } from './groq.js';
import { OllamaProvider } from './ollama.js';
import type { AIProvider } from './provider.js';

let current: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (current) return current;

  current =
    config.ai.provider === 'ollama' ? new OllamaProvider() : new GroqProvider();

  if (current.isLocal) {
    console.log(`[ai] using local Ollama model: ${config.ai.ollama.model}`);
  } else {
    console.log(`[ai] using hosted Groq model: ${config.ai.groq.model}`);
  }

  return current;
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

export async function identifyBusinessTypes(service: string): Promise<string[]> {
  try {
    const prompt = `List the types of local, consumer-facing businesses that most often need ${service}.

These must be physical local businesses that serve individual customers — NOT business services, consultants, agencies, or companies that provide ${service} themselves. Never include a business type that offers ${service}.

For example, for "web design" the answer is: restaurant, salon, auto repair shop, dental clinic, gym, real estate agent, plumber, electrician, roofer, pet groomer, coffee shop, bakery.

For "${service}", list 8-12 similar local business types. Return JSON with a single key "types" containing an array of business type names (lowercase, no explanations). Example: {"types": ["restaurant", "salon"]}`;

    const parsed = extractJson(await getProvider().complete(prompt, true)) as { types?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.types)) return [];
    return (parsed.types as unknown[])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
  } catch (error) {
    console.warn('Business type identification failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function classifyLead(
  lead: Pick<BusinessLead, 'name' | 'address' | 'website' | 'rating' | 'reviewCount' | 'category' | 'hasWebsite'>,
  service: string,
): Promise<ClassificationResult> {
  try {
    const parsed = extractJson(
      await getProvider().complete(buildClassificationPrompt(lead, service), true),
    ) as ClassificationResult | null;
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
  senderName = 'Alex',
): Promise<EmailDraft> {
  try {
    const parsed = extractJson(
      await getProvider().complete(buildOutreachPrompt(lead, service, senderName), true),
    ) as EmailDraft | null;
    if (!parsed) return fallbackEmail(lead, service, senderName);
    return {
      subject: String(parsed.subject || ''),
      body: String(parsed.body || ''),
      tone: parsed.tone ?? 'professional',
    };
  } catch (error) {
    console.warn('Email drafting failed:', error instanceof Error ? error.message : error);
    return fallbackEmail(lead, service, senderName);
  }
}

function fallbackEmail(lead: BusinessLead, service: string, senderName: string): EmailDraft {
  return {
    subject: `${lead.name} — a ${service} thought`,
    body: `Hi ${lead.name} team,\n\nI came across your business and had a few ideas about how I could help with ${service}. Would you be open to a quick 10-minute call this week?\n\nBest,\n${senderName}`,
    tone: 'professional',
  };
}

function buildClassificationPrompt(
  lead: Pick<BusinessLead, 'name' | 'address' | 'website' | 'rating' | 'reviewCount' | 'category' | 'hasWebsite'>,
  service: string,
): string {
  return `Classify how likely this business is to need ${service} services.

Business: ${lead.name}
Address: ${lead.address}
Category: ${lead.category || 'unknown'}
hasWebsite: ${lead.hasWebsite ? 'true' : 'false'}
${lead.website ? `Website: ${lead.website}` : 'No website found'}
Google Rating: ${lead.rating || 'N/A'} (${lead.reviewCount || 0} reviews)

Score 0-100 on how badly this business needs ${service}, using these bands:
- 90-100: active customer-facing business with no website at all
- 70-89: has a website but it is dated or incomplete
- 40-69: solid online presence, a modest opportunity
- 0-39: strong online presence, not a prospect worth contacting

Use only these three keys:

{
  "score": <integer 0-100>,
  "signals": [
    { "type": "no_website", "description": "<short reason>", "severity": "high" },
    { "type": "outdated_website", "description": "<short reason>", "severity": "medium" },
    { "type": "no_google_business", "description": "<short reason>", "severity": "low" }
  ],
  "reasoning": "<one sentence>"
}

"type" must be one of: no_website, outdated_website, no_google_business, bad_reviews_no_response, no_social_presence.
"severity" must be the string high, medium, or low — never a number.
Return only the JSON object, with no text before or after it.

Hard rules:
- This business came from Google Maps, so it already has a Google Business Profile. NEVER report no_google_business.
- hasWebsite is ${lead.hasWebsite ? 'true' : 'false'}. If it is true, NEVER report no_website, and never say it has no website.
- Only report a signal the listed data supports. Do not guess about languages, layout, design or anything not given here.
- Do not repeat a signal you already listed.`;
}

function buildOutreachPrompt(
  lead: BusinessLead,
  service: string,
  senderName: string,
): string {
  const signalSummary = lead.signals
    .map((s) => `- ${s.description} (${s.severity})`)
    .join('\n');

  const reviews = lead.reviewCount ?? 0;
  const reputation = reviews >= 5
    ? `${lead.rating} stars from ${reviews} reviews`
    : 'very few public reviews';

  return `You are ${senderName}, a freelance ${service} provider, writing to a potential client.

Business: ${lead.name}
Location: ${lead.address}
hasWebsite: ${lead.hasWebsite ? 'true' : 'false'}
${lead.website ? `Website: ${lead.website}` : 'No website found'}
Reputation: ${reputation}

Signals already detected (do not repeat or invent others):
${signalSummary || '- none'}

Write a short email, under 120 words, that:
1. Opens by naming the business directly. Never open with "I hope this email finds you well".
2. Cites only facts from the list above.${reviews < 5 ? ' This business has very few reviews, so never mention review counts or ratings.' : ''}
3. States one concrete problem you noticed.
4. Ends with a clear low-friction ask.
5. Reads like a person writing to another person, not a template.

This business is a prospective customer, not a competitor. Never describe it as offering ${service}.
Sign off as ${senderName}. Never write "[Your Name]".

Return only the JSON object, with no text before or after it:
{ "subject": "<short line>", "body": "<email under 120 words>", "tone": "friendly" }
where tone is exactly one of: professional, friendly, direct`;
}
