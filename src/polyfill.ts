import { fetch as serverNetFetch, FetchHeaders, type FetchRequestInit } from './fetch';

function toStandardHeaders(headers: FetchHeaders): Headers | FetchHeaders {
	const HeadersCtor = (globalThis as { Headers?: typeof Headers }).Headers;
	if (typeof HeadersCtor === 'function') {
		const standard = new HeadersCtor();
		for (const [key, value] of headers.entries()) {
			if (typeof (standard as Headers).append === 'function') {
				standard.append(key, value);
			} else {
				standard.set(key, value);
			}
		}
		return standard;
	}
	return headers;
}

export type FetchPolyfillOptions = {
	force?: boolean;
};

export async function fetchPolyfill(
	input: any,
	init?: FetchRequestInit | RequestInit
): Promise<Response> {
	const response = (await serverNetFetch(input as string, init as FetchRequestInit)) as {
		status: number;
		ok: boolean;
		headers: FetchHeaders;
		url: string;
		text: () => Promise<string>;
		json: <T = unknown>() => Promise<T>;
	};

	const headers = toStandardHeaders(response.headers);

	const responseLike = {
		status: response.status,
		ok: response.ok,
		headers,
		url: response.url,
		text: () => response.text(),
		json: <T = unknown>() => response.json<T>(),
	} as unknown as Response;

	return responseLike;
}

export function installFetchPolyfill(options: FetchPolyfillOptions = {}): void {
	type FetchLike = (input: any, init?: RequestInit) => Promise<Response>;
	const target = globalThis as unknown as { fetch?: FetchLike };
	if (options.force || typeof target.fetch !== 'function') {
		target.fetch = fetchPolyfill as FetchLike;
	}
}
