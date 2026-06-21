# server-net-fetch

A thin `fetch`-compatible wrapper for Minecraft Bedrock Dedicated Server Script API using `@minecraft/server-net`.

## Install

```bash
pnpm install @tutinoko2048/server-net-fetch
```
```bash
bun install @tutinoko2048/server-net-fetch
```
```bash
npm install @tutinoko2048/server-net-fetch
```

## Usage

```ts
import { fetch, FetchHeaders } from '@tutinoko2048/server-net-fetch';

const res = await fetch('https://example.com/api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ hello: 'world' }),
  timeout: 10,
});

const text = await res.text();
```

- Can be used with [`hono`](https://hono.dev/)
```ts
import { world } from '@minecraft/server';
import { hc } from 'hono/client';
import { fetch } from '@tutinoko2048/server-net-fetch';

const client = hc<AppType>('http://localhost:3000', { fetch });

world.afterEvents.worldLoad.subscribe(async () => {
  const res = await client.index.$get();
  console.log(await res.text());
});
```

## Polyfill-style usage

For libraries that do not allow injecting a custom fetch, you can install a lightweight polyfill.

```ts
import { installFetchPolyfill } from '@tutinoko2048/server-net-fetch';

installFetchPolyfill();
```

Or use a side-effect import:

```ts
import '@tutinoko2048/server-net-fetch/register';
```

## Limitations

- Only methods supported by `@minecraft/server-net` (GET/POST/PUT/DELETE/HEAD)
- `body` is not allowed for `GET` / `HEAD`
- Browser-specific features like `AbortSignal` are not supported
- Polyfill responses are minimal (status/ok/headers/url/text/json)

---

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
