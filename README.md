# server-net-fetch

A thin `fetch`-compatible wrapper for Minecraft Bedrock Dedicated Server Script API using `@minecraft/server-net`.

## Install

```bash
pnpm add @tutinoko2048/server-net-fetch
```
```bash
bun add @tutinoko2048/server-net-fetch
```
```bash
npm install @tutinoko2048/server-net-fetch
```

## Usage

```ts
import { fetch } from '@tutinoko2048/server-net-fetch';

const res = await fetch('https://example.com/api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ hello: 'world' }),
  timeout: 10, // seconds
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

It does nothing if `globalThis.fetch` is already defined. Pass `{ force: true }` to overwrite it.

Or use a side-effect import:

```ts
import '@tutinoko2048/server-net-fetch/register';
```

### Global polyfills

Importing this package also sets the following globals, which the Script API does not provide:

- `Headers` (always overwritten)
- `URLSearchParams` (always overwritten)
- `URL` (only if `globalThis.URL` is not already defined)

`URL` is a minimal implementation mainly for `http(s)://host[:port]/path?query#hash` style URLs. Other schemes such as `ws:`, `ftp:` and `mailto:` are parsed as well.

- Parses absolute URLs and resolves relative URLs against a base (`/abs`, `rel`, `./rel`, `../rel`, `?q`, `#h`, `//host/path`)
- Throws `TypeError` for invalid URLs; `URL.canParse()` is available
- Lowercases the scheme, lowercases the hostname of http/https/ws/wss/ftp URLs, omits default ports (http/ws: 80, https/wss: 443, ftp: 21), and resolves `.` / `..` path segments
- Percent-encodes spaces and non-ASCII characters in the path, query and fragment (existing `%XX` sequences are kept as is)
- `searchParams` stays in sync with `search` / `href` in both directions

Not supported:

- IDN / punycode: non-ASCII hostnames (e.g. `http://日本.jp/`) throw `TypeError`
- IPv6 normalization (bracketed hosts like `[::1]` are only lowercased)
- IPv4 shorthand normalization (e.g. `0x7f.1`)
- `file:` scheme specifics such as Windows drive letters
- `origin` of non-special schemes such as `blob:` (always `'null'`)

## Limitations

- Only methods supported by `@minecraft/server-net` (GET/POST/PUT/DELETE/HEAD)
- `body` is not allowed for `GET` / `HEAD`
- `body` must be a string. The polyfill silently drops other body types such as `URLSearchParams` or `Blob`
- When a `Request` object is passed to the polyfill, only its `url` is used; its method, headers and body are ignored
- Browser-specific features like `AbortSignal` are not supported
- Polyfill responses are minimal (status/ok/headers/url/text/json). `arrayBuffer()` and `blob()` return empty data, and `statusText` is always `"OK"` or `"Error"`
