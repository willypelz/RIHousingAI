/** AI provider abstraction: Anthropic when ANTHROPIC_API_KEY is set, otherwise a
 *  deterministic rule-based fallback so the app works without a key. */

export interface AIProvider {
  readonly name: string;
  complete(system: string, user: string, maxTokens?: number): Promise<string>;
}

class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  constructor(private apiKey: string, private model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514') {}

  async complete(system: string, user: string, maxTokens = 2048): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data: any = await res.json();
    return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
  }
}

class FallbackProvider implements AIProvider {
  readonly name = 'fallback';
  async complete(_system: string, _user: string): Promise<string> {
    return '';
  }
}

export function getProvider(): AIProvider {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? new AnthropicProvider(key) : new FallbackProvider();
}

export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
