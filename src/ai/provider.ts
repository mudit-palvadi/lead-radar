export interface AIProvider {
  /** Short identifier, used in logs. */
  readonly name: string;
  /** True when the model runs on this machine and no data leaves it. */
  readonly isLocal: boolean;
  /**
   * Send one prompt, get back the raw text completion.
   * @param json ask the provider for structured JSON output.
   */
  complete(prompt: string, json?: boolean): Promise<string>;
}
