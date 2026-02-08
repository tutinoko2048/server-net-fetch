import { describe, expect, it } from 'bun:test';
import { fetch as serverNetFetch } from '../../src/fetch';

import { hc } from 'hono/client';

describe('hono client options', () => {
  it('accepts server-net fetch', () => {
    const client = hc('https://example.com', {
      fetch: serverNetFetch,
    });

    expect(client).toBeDefined();
  });
});
