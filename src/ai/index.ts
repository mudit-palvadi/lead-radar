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
      return { score: 50, reasoning: 'Could not parse classification result.' };
    }
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch (error) {
    console.warn('Classification failed:', error instanceof Error ? error.message : error);
    return { score: 50, reasoning: 'Classification unavailable.' };
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
- 70-89: weak online presence, worth a conversation
- 40-69: some presence, a modest opportunity
- 0-39: strong online presence, not a prospect worth contacting

Return only the JSON object, with no text before or after it:

{ "score": <integer 0-100>, "reasoning": "<one sentence>" }

Hard rules:
- You have NOT visited this website. You only have its address. Never say anything about its design, layout, content or age.
- Judge only what the fields above tell you. The score must follow the bands.
- Keep "reasoning" to one short sentence.`;
}

function buildOutreachPrompt(
  lead: BusinessLead,
  service: string,
  senderName: string,
): string {
  const reviews = lead.reviewCount ?? 0;

  // Only offer reputation as a fact when it's substantial. Describing a thin
  // review count just makes the model write "given your few reviews".
  const reputation =
    reviews >= 5 && lead.rating
      ? `${lead.rating} stars from ${reviews} reviews`
      : 'not enough public reviews to be worth citing';

  const facts: string[] = [];
  if (!lead.hasWebsite) facts.push('it has no website of its own');
  if (reviews >= 5 && lead.rating) facts.push(`it has ${lead.rating} stars from ${reviews} reviews`);
  if (lead.category) facts.push(`it is a ${lead.category}`);

  return `You are ${senderName}, a freelance ${service} provider, writing to a potential client.

What you know about this business:
- Name: ${lead.name}
- Location: ${lead.address}${lead.category ? `\n- Trade: ${lead.category}` : ''}
- Website: ${lead.website || 'none'}
- Reputation: ${reputation}

${facts.length > 0 ? `Things worth mentioning: ${facts.join('; ')}.` : 'Nothing stands out about this business online.'}

Write a short email, under 120 words, that:
1. Opens by naming the business directly. Never open with "I hope this email finds you well".
2. Mentions at most ONE of the things above. Never mention more than one problem.
3. Explains that point in your own words. Never paste these notes into the email, never quote them in brackets or parentheses, and never repeat a fact twice.
4. Ends with a clear low-friction ask.
5. Reads like a person writing to another person, not a template.
${reviews < 5 ? '6. Do not mention reviews or ratings at all in this email.\n' : ''}
You have NOT visited the website. Never comment on its design, layout or content.

This business is a prospective customer, not a competitor. Never describe it as offering ${service}.
Sign off as ${senderName}. Never write "[Your Name]".

Return only the JSON object, with no text before or after it:
{ "subject": "<short line>", "body": "<email under 120 words>", "tone": "friendly" }
where tone is exactly one of: professional, friendly, direct`;
}
