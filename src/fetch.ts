import { HttpHeader, HttpRequest, HttpRequestMethod, http } from '@minecraft/server-net';

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';

export type HeadersInit =
	| Record<string, string>
	| Array<[string, string]>
	| Array<string[]>
	| Iterable<[string, string]>
	| FetchHeaders;

export interface FetchRequestInit {
	method?: RequestMethod;
	headers?: HeadersInit;
	body?: string;
	timeout?: number;
}

export class FetchHeaders {
	private readonly map = new Map<string, string>();

	constructor(init?: HeadersInit) {
		if (!init) return;
		if (init instanceof FetchHeaders) {
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
// @ts-expect-error
globalThis.Headers = FetchHeaders;

export class FetchResponse {
	readonly status: number;
	readonly ok: boolean;
	readonly headers: FetchHeaders;
	readonly url: string;
	private readonly bodyText: string;

	constructor(options: { status: number; headers: FetchHeaders; url: string; bodyText: string }) {
		this.status = options.status;
		this.ok = options.status >= 200 && options.status < 300;
		this.headers = options.headers;
		this.url = options.url;
		this.bodyText = options.bodyText;
	}

	async text(): Promise<string> {
		return this.bodyText;
	}

	async json<T = unknown>(): Promise<T> {
		return JSON.parse(this.bodyText) as T;
	}
}

const METHOD_MAP: Record<RequestMethod, HttpRequestMethod> = {
	GET: HttpRequestMethod.Get,
	POST: HttpRequestMethod.Post,
	PUT: HttpRequestMethod.Put,
	DELETE: HttpRequestMethod.Delete,
	HEAD: HttpRequestMethod.Head,
};

function toRequestMethod(method?: string): HttpRequestMethod {
	const normalized = (method ?? 'GET').toUpperCase() as RequestMethod;
	const mapped = METHOD_MAP[normalized];
	if (!mapped) {
		throw new Error(`Unsupported method: ${method}`);
	}
	return mapped;
}

function toHeaders(init?: HeadersInit): FetchHeaders {
	return init instanceof FetchHeaders ? init : new FetchHeaders(init);
}

function toHttpHeaders(headers: FetchHeaders): HttpHeader[] {
	return headers.entries().map(([key, value]) => new HttpHeader(key, value));
}

async function serverNetFetchInternal(input: any, init: FetchRequestInit = {}): Promise<FetchResponse> {
	const url = typeof input === 'string' ? input : (input?.url ?? String(input));
	const method = (init.method ?? 'GET').toUpperCase();
	if ((method === 'GET' || method === 'HEAD') && typeof init.body === 'string') {
		throw new Error('Body is not allowed for GET or HEAD requests.');
	}

	const request = new HttpRequest(url);
	request.method = toRequestMethod(method);

	if (typeof init.timeout === 'number') {
		request.timeout = init.timeout;
	}

	const headers = toHeaders(init.headers);
	if (headers.entries().length > 0) {
		request.headers = toHttpHeaders(headers);
	}

	if (typeof init.body === 'string') {
		request.body = init.body;
	}

	const response = await http.request(request);
	const responseHeaders = new FetchHeaders();
	// for ofを使うとvalue is not iterable errorが出るため
	for (let i = 0; i < response.headers.length; i++) {
		const h = response.headers[i]!;
		responseHeaders.set(h.key, h.value as string);
	}

	return new FetchResponse({
		status: response.status,
		headers: responseHeaders,
		url: response.request?.uri ?? url,
		bodyText: response.body ?? '',
	});
}

export async function fetch(url: string, init?: FetchRequestInit): Promise<FetchResponse>;
export async function fetch(
	input: any,
	requestInit?: RequestInit,
	_env?: unknown,
	_executionCtx?: unknown
): Promise<Response>;
export async function fetch(
	input: any,
	init?: FetchRequestInit | RequestInit
): Promise<FetchResponse | Response> {
	const resolvedInit = (init ?? {}) as FetchRequestInit;
	return serverNetFetchInternal(input, resolvedInit);
}
