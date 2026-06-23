import { fetch as serverNetFetch, type FetchRequestInit } from './fetch';
import type { Headers as FetchHeaders } from './polyfill/headers';

function toStandardHeaders(headers: FetchHeaders): any {
	const HeadersCtor = (globalThis as any).Headers;
	if (typeof HeadersCtor === 'function') {
		const standard = new HeadersCtor();
		for (const [key, value] of headers.entries()) {
			if (typeof standard.append === 'function') {
				standard.append(key, value);
			} else {
				standard.set(key, value);
			}
		}
		return standard;
	}
	return headers;
}

export type PolyfillOptions = {
	force?: boolean;
};

export async function fetchPolyfill(
	input: string | URL | globalThis.Request | { url: string },
	init?: globalThis.RequestInit | (FetchRequestInit & Record<string, any>)
): Promise<globalThis.Response> {
	// Request / input matching
	const url = typeof input === 'string' 
		? input 
		: input instanceof URL 
			? input.toString() 
			: (input as { url: string }).url;

	// Init mapping
	const internalInit: FetchRequestInit = {};
	if (init) {
		if (init.method) internalInit.method = init.method as any;
		if (init.headers) internalInit.headers = init.headers as any;
		if (typeof init.body === 'string') internalInit.body = init.body;
		if (typeof (init as any).timeout === 'number') internalInit.timeout = (init as any).timeout;
	}

	const response = await serverNetFetch(url, internalInit);

	const headers = toStandardHeaders(response.headers);

	const responseLike = {
		status: response.status,
		ok: response.ok,
		headers,
		url: response.url,
		text: () => response.text(),
		json: <T = unknown>() => response.json<T>(),
		// Minimal Response standard properties
		redirected: false,
		statusText: response.ok ? "OK" : "Error",
		type: "basic" as const,
		clone() { return { ...this }; },
		body: null,
		bodyUsed: false,
		arrayBuffer: async () => new ArrayBuffer(0),
		blob: async () => new Blob([]),
		formData: async () => { throw new Error("Not implemented"); }
	};

	return responseLike as unknown as globalThis.Response;
}

export function installFetchPolyfill(options: PolyfillOptions = {}): void {
	const target = globalThis as any;
	if (options.force || typeof target.fetch !== 'function') {
		target.fetch = fetchPolyfill;
	}
}
