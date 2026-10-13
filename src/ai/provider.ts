export interface AIProvider {
  /** Short identifier, used in logs. */
  readonly name: string;
  /** True when the model runs on this machine and no data leaves it. */
  readonly isLocal: boolean;
  /** Send one prompt, get back the raw text completion. */
  complete(prompt: string): Promise<string>;
}
