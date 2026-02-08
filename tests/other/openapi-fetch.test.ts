import { describe, expect, it } from 'bun:test';
import { fetch as serverNetFetch } from '../../src/fetch';

import createClient from 'openapi-fetch';

describe('openapi-fetch client options', () => {
  it('accepts server-net fetch', () => {
    const client = createClient({ fetch: serverNetFetch });

    expect(client).toBeDefined();
  });
});
