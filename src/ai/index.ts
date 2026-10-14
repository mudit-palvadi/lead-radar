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

/**
 * The model reliably forgets to sign, because "end with a clear ask" competes
 * with "sign off as Alex" in the same prompt. Rather than fight over the
 * instructions, check the tail and add the signature ourselves.
 */
export function ensureSignOff(body: string, senderName: string): string {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return `Best,\n${senderName}`;

  const tail = trimmed.slice(-80).toLowerCase();
  if (tail.includes(senderName.toLowerCase())) return trimmed;

  return `${trimmed}\n\nBest,\n${senderName}`;
}

/**
 * Sentences where the model confesses it never looked at something
 * ("I haven't checked your website") read as unprofessional in outreach.
 * The prompt tells it not to comment on things it hasn't seen; when that
 * leaks into the email anyway, strip it here rather than trusting the prompt.
 */
export function cleanEmailBody(body: string): string {
  const confession =
    /\s*[^.!?]*\b(i\s+(have\s*(not|n'?t)|has\s*(not|n'?t)|did\s*(not|n'?t)|could\s*(not|n'?t)|ca\s*(not|n'?t)|was\s*(not|n'?t)|were\s*(not|n'?t)|had\s*(not|n'?t))|i\s+am\s+unable\s+to|i\s+do\s*not\s+have\s+access\s+to)[^.!?]*[.!?]/gi;
  const cleaned = (body ?? '').replace(confession, '').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned || (body ?? '').trim();
}

/**
 * The old prompt told every freelancer "offering to build one is the natural
 * pitch" whenever a lead had no website — so a social media marketer ended up
 * pitching websites. The pitch must always be the user's own service.
 */
export function pitchGuidance(service: string, hasWebsite: boolean): string {
  const offersWeb = /\bweb(?:site)?s?\b|\bsite\b|\bweb\s*dev|\bfront-?end\b/i.test(service);

  if (!hasWebsite && !offersWeb) {
    return (
      `This business has no website. That is context, NOT your pitch. ` +
      `You do ${service} — you do not build websites. Never offer to build, design, ` +
      `redesign, or "create" a website. Instead, frame the missing website as the ` +
      `visibility problem your service solves (customers searching for them find ` +
      `nothing; competitors show up first), and pitch ${service} as the fix.`
    );
  }
  if (!hasWebsite && offersWeb) {
    return (
      `This business has no website, and your service is ${service}, so offering ` +
      `to build one is the natural pitch.`
    );
  }
  return (
    `This business already has a website. Never offer to build them one or tell ` +
    `them they need an online presence. Pitch ${service} as the way to get more ` +
    `out of what they already have.`
  );
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
      body: ensureSignOff(cleanEmailBody(String(parsed.body || '')), senderName),
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

  // Handing the model a menu made it pick two and write both into the email.
  // Give it exactly one thing worth saying and let it put that in its own words.
  const hook = !lead.hasWebsite
    ? 'it has no website of its own'
    : reviews >= 5 && lead.rating
      ? `it has ${lead.rating} stars from ${reviews} reviews`
      : lead.category
        ? `it is a ${lead.category} business`
        : null;

  return `You are ${senderName}, a freelance ${service} provider, writing to a potential client.

What you know about this business:
- Name: ${lead.name}
- Location: ${lead.address}${lead.category ? `\n- Trade: ${lead.category}` : ''}
- Website: ${lead.website || 'none'}

${hook ? `The one thing worth mentioning: ${hook}.` : 'Nothing stands out about this business online, so keep the email short and general.'}

Write a short email, under 120 words, that:
1. Opens by naming the business directly. Never open with "I hope this email finds you well".
2. Build on that one thing. Never bring up a second problem, and never mention anything else from the list above.
3. Explains that point in your own words. Never paste these notes into the email, never quote them in brackets or parentheses, and never repeat a fact twice.
4. Ends with a clear low-friction ask.
5. Reads like a person writing to another person, not a template.
6. Address the business as "you". Never write "they", "their" or "their business".
7. ${pitchGuidance(service, lead.hasWebsite)}
8. Your ONLY offer is ${service}. Never offer web design, web development, SEO, logo design, or any other service — even if the business seems to need it.
${reviews < 5 ? '9. Do not mention reviews or ratings at all in this email.\n' : ''}
Never describe or judge the website's design, layout, content, or age — simply do not bring those topics up at all. Never mention what you have or have not checked, visited, or reviewed; just write about the business.

This business is a prospective customer, not a competitor. Never describe it as offering ${service}.
Sign off as ${senderName}. Never write "[Your Name]".

Return only the JSON object, with no text before or after it:
{ "subject": "<short line>", "body": "<email under 120 words>", "tone": "friendly" }
where tone is exactly one of: professional, friendly, direct`;
}
