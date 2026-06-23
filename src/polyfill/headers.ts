export type HeadersInit =
  | Record<string, string>
  | Array<[string, string]>
  | Array<string[]>
  | Iterable<[string, string]>
  | Headers;

export class Headers {
  private readonly map = new Map<string, string>();

  constructor(init?: HeadersInit) {
    if (!init) return;
    if (init instanceof Headers) {
      for (const [key, value] of init.entries()) {
        this.set(key, value);
      }
      return;
    }
    if (Array.isArray(init)) {
      for (const [key, value] of init) {
        this.set(key, value);
      }
      return;
    }
    for (const [key, value] of Object.entries(init)) {
      this.set(key, value);
    }
  }

  set(key: string, value: string): void {
    this.map.set(key.toLowerCase(), value);
  }

  get(key: string): string | undefined {
    return this.map.get(key.toLowerCase());
  }

  has(key: string): boolean {
    return this.map.has(key.toLowerCase());
  }

  entries(): Array<[string, string]> {
    return Array.from(this.map.entries());
  }

  toObject(): Record<string, string> {
    return Object.fromEntries(this.map.entries());
  }
}
