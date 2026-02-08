import { beforeEach, describe, expect, it, mock } from 'bun:test';

let lastRequest: HttpRequest | undefined;
let nextResponse: HttpResponse;

mock.module('@minecraft/server-net', () => {
  class HttpHeader {
    key: string;
    value: string;
    constructor(key: string, value: string) {
      this.key = key;
      this.value = value;
    }
  }

  class HttpRequest {
    uri: string;
    method: HttpRequestMethod | undefined;
    headers: HttpHeader[] | undefined;
    timeout: number | undefined;
    body: string | undefined;

    constructor(uri: string) {
      this.uri = uri;
    }
  }

  const http = {
    request: async (request: HttpRequest) => {
      lastRequest = request;
      return {
        status: nextResponse.status,
        headers: nextResponse.headers,
        request: nextResponse.request ?? request,
        body: nextResponse.body,
      } satisfies HttpResponse;
    },
  };

  return {
    HttpHeader,
    HttpRequest,
    HttpRequestMethod: {
      Get: 'Get',
      Post: 'Post',
      Put: 'Put',
      Delete: 'Delete',
      Head: 'Head',
    },
    http,
  };
});

type HttpRequestMethod = 'Get' | 'Post' | 'Put' | 'Delete' | 'Head';

type HttpRequest = {
  uri: string;
  method?: HttpRequestMethod;
  headers?: { key: string; value: string }[];
  timeout?: number;
  body?: string;
};

type HttpResponse = {
  status: number;
  headers?: { key: string; value: string }[];
  request?: { uri: string };
  body?: string;
};

async function loadFetchModule() {
  return await import('../src/fetch');
}

async function loadPolyfillModule() {
  return await import('../src/polyfill');
}

beforeEach(() => {
  lastRequest = undefined;
  nextResponse = {
    status: 200,
    headers: [],
    body: '',
  };
});

describe('fetch wrapper', () => {
  it('rejects GET with body', async () => {
    const { fetch } = await loadFetchModule();
    await expect(
      fetch('https://example.com', {
        method: 'GET',
        body: 'nope',
      })
    ).rejects.toThrow('Body is not allowed for GET or HEAD requests.');
  });

  it('maps method to HttpRequestMethod', async () => {
    const { fetch } = await loadFetchModule();
    await fetch('https://example.com', { method: 'POST' });
    expect(lastRequest?.method).toBe('Post');
  });

  it('applies headers with lowercase keys', async () => {
    const { fetch } = await loadFetchModule();
    await fetch('https://example.com', {
      headers: {
        'Content-Type': 'application/json',
        Auth: 'token',
      },
    });

    expect(lastRequest?.headers?.length).toBe(2);
    const headerKeys = lastRequest?.headers?.map((h) => h.key).sort();
    expect(headerKeys).toEqual(['auth', 'content-type']);
  });

  it('sets timeout and body', async () => {
    const { fetch } = await loadFetchModule();
    await fetch('https://example.com', {
      method: 'PUT',
      timeout: 12,
      body: 'payload',
    });

    expect(lastRequest?.timeout).toBe(12);
    expect(lastRequest?.body).toBe('payload');
  });

  it('creates FetchResponse with headers and url', async () => {
    const { fetch } = await loadFetchModule();
    nextResponse = {
      status: 201,
      headers: [{ key: 'X-Test', value: 'ok' }],
      request: { uri: 'https://redirected.example.com' },
      body: '{"ok":true}',
    };

    const res = await fetch('https://example.com');
    expect(res.status).toBe(201);
    expect(res.ok).toBe(true);
    expect(res.url).toBe('https://redirected.example.com');
    expect(res.headers.get('x-test')).toBe('ok');
    await expect(res.text()).resolves.toBe('{"ok":true}');
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

describe('FetchHeaders', () => {
  it('supports set/get/has/entries/toObject', async () => {
    const { FetchHeaders } = await loadFetchModule();
    const headers = new FetchHeaders({ Foo: 'bar' });
    headers.set('Baz', 'qux');

    expect(headers.get('foo')).toBe('bar');
    expect(headers.has('baz')).toBe(true);

    const entries = headers.entries().sort(([a], [b]) => a.localeCompare(b));
    expect(entries).toEqual([
      ['baz', 'qux'],
      ['foo', 'bar'],
    ]);

    expect(headers.toObject()).toEqual({ foo: 'bar', baz: 'qux' });
  });
});

describe('polyfill', () => {
  it('returns response-like object with text/json', async () => {
    const { fetchPolyfill } = await loadPolyfillModule();
    nextResponse = {
      status: 200,
      headers: [{ key: 'X-Poly', value: 'ok' }],
      request: { uri: 'https://example.com/poly' },
      body: '{"hello":"world"}',
    };

    const res = await fetchPolyfill('https://example.com/poly');
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect((res as { url?: string }).url).toBe('https://example.com/poly');
    await expect(res.text()).resolves.toBe('{"hello":"world"}');
    await expect(res.json()).resolves.toEqual({ hello: 'world' });
  });

  it('installFetchPolyfill injects fetch when missing', async () => {
    const { installFetchPolyfill } = await loadPolyfillModule();
    const target = globalThis as { fetch?: unknown };
    const previous = target.fetch;
    delete target.fetch;

    installFetchPolyfill();
    expect(typeof target.fetch).toBe('function');

    target.fetch = previous;
  });

  it('register side-effect installs fetch', async () => {
    const target = globalThis as { fetch?: unknown };
    const previous = target.fetch;
    delete target.fetch;

    await import('../src/register');
    expect(typeof target.fetch).toBe('function');

    target.fetch = previous;
  });
});
