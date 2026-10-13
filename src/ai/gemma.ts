import { Ollama } from 'ollama';
import type { BusinessLead, ClassificationResult, EmailDraft, LeadSignal } from '../types.js';
import { config } from '../config.js';

const ollama = new Ollama({ host: config.ollama.host });

export async function classifyLead(
  lead: Pick<BusinessLead, 'name' | 'address' | 'website' | 'rating' | 'reviewCount' | 'category'>,
  service: string,
): Promise<ClassificationResult> {
  const prompt = buildClassificationPrompt(lead, service);

  const response = await ollama.generate({
    model: config.ollama.model,
    prompt,
    format: {
      type: 'object',
      properties: {
        score: { type: 'number', description: '0-100 likelihood this business needs the service' },
        signals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              description: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
        reasoning: { type: 'string' },
      },
      required: ['score', 'signals', 'reasoning'],
    },
    stream: false,
  });

  try {
    const parsed = JSON.parse(response.response);
    return {
      score: Math.min(100, Math.max(0, parsed.score)),
      signals: parsed.signals as LeadSignal[],
      reasoning: parsed.reasoning,
    };
  } catch {
    return { score: 50, signals: [], reasoning: 'Could not parse classification result.' };
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

  const response = await ollama.generate({
    model: config.ollama.model,
    prompt,
    format: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        tone: { type: 'string', enum: ['professional', 'friendly', 'direct'] },
      },
      required: ['subject', 'body', 'tone'],
    },
    stream: false,
  });

  try {
    return JSON.parse(response.response);
  } catch {
    return {
      subject: `Helping ${lead.name} with ${service}`,
      body: `Hi ${lead.name} team,\n\nI noticed your business online and had some ideas about how I could help with your ${service} needs. Would you be open to a quick 10-minute call this week?\n\nBest regards`,
      tone: 'professional',
    };
  }
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
