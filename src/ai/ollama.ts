import type { AIProvider } from './provider.js';
import { config } from '../config.js';

/** Local open-weight inference. No API key, no network, nothing leaves the machine. */
export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  readonly isLocal = true;

  async complete(prompt: string): Promise<string> {
    const response = await fetch(`${config.ai.ollama.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ai.ollama.model,
        prompt,
        stream: false,
        options: { temperature: 0 },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { response?: string };
    return data.response ?? '';
  }
}
