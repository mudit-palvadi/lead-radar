import type { AIProvider } from './provider.js';
import { config } from '../config.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 2000;

async function fetchWithRetry(payload: object): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return response;

    const errorText = await response.text();
    lastError = new Error(`Groq API error (${response.status}): ${errorText.slice(0, 200)}`);

    if (response.status !== 429) throw lastError;

    const delay = BASE_DELAY_MS * Math.pow(2, attempt);
    console.warn(`[ai] rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw lastError ?? new Error('Groq API failed after retries');
}

/** Hosted open-weight inference. Free tier, sub-second, needs an API key. */
export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  readonly isLocal = false;

  async complete(prompt: string, json = false): Promise<string> {
    const payload: Record<string, unknown> = {
      model: config.ai.groq.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 700,
    };

    // Without this the model prefixes prose and the JSON gets truncated.
    if (json) payload.response_format = { type: 'json_object' };

    const data = (await (await fetchWithRetry(payload)).json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? '';
  }
}