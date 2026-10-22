import { URLSearchParams } from "./url-search-params";

/**
 * Default ports of special schemes.
 * https://url.spec.whatwg.org/#special-scheme
 */
const SPECIAL_SCHEMES: Record<string, string> = {
  ftp: "21",
  http: "80",
  https: "443",
  ws: "80",
  wss: "443",
};

// Percent-encode sets (in addition to C0 controls and code points > U+007E).
// https://url.spec.whatwg.org/#percent-encoded-bytes
const FRAGMENT_SET = ' "<>`';
const QUERY_SET = ' "#<>';
const SPECIAL_QUERY_SET = QUERY_SET + "'";
const PATH_SET = QUERY_SET + "?^`{}";
const USERINFO_SET = PATH_SET + "/:;=@[\\]|";

interface URLRecord {
  scheme: string;
  username: string;
  password: string;
  host: string | null;
  port: string;
  /** A list of segments, or a string for opaque paths (e.g. `mailto:`). */
  path: string[] | string;
  query: string | null;
  fragment: string | null;
}

function isSpecial(scheme: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPECIAL_SCHEMES, scheme);
}

function encodeChar(ch: string): string {
  const code = ch.codePointAt(0)!;
  if (code < 0x80) {
    return "%" + (code < 0x10 ? "0" : "") + code.toString(16).toUpperCase();
  }
  try {
    return encodeURIComponent(ch);
  } catch {
    // Lone surrogate: encode as U+FFFD
    return "%EF%BF%BD";
  }
}

/**
 * Percent-encodes C0 controls, non-ASCII and the given characters.
 * `%` is left untouched, so already-encoded sequences are not encoded twice.
 */
function encode(input: string, set: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    out += code < 0x20 || code > 0x7e || set.includes(ch) ? encodeChar(ch) : ch;
  }
  return out;
}

/** Decodes valid `%XX` sequences and leaves anything else as is. */
function percentDecode(input: string): string {
  return input.replace(/(?:%[0-9a-fA-F]{2})+/g, (m) => {
    try {
      return decodeURIComponent(m);
    } catch {
      return m;
    }
  });
}

function parseQuery(query: string | null): [string, string][] {
  const list: [string, string][] = [];
  if (!query) return list;
  const decode = (s: string) => percentDecode(s.replace(/\+/g, " "));
  for (const pair of query.split("&")) {
    if (pair === "") continue;
    const index = pair.indexOf("=");
    if (index === -1) {
      list.push([decode(pair), ""]);
    } else {
      list.push([decode(pair.slice(0, index)), decode(pair.slice(index + 1))]);
    }
  }
  return list;
}

function encodeQuery(query: string, scheme: string): string {
  return encode(query, isSpecial(scheme) ? SPECIAL_QUERY_SET : QUERY_SET);
}

function splitQueryAndFragment(
  input: string
): [rest: string, query: string | null, fragment: string | null] {
  let rest = input;
  let query: string | null = null;
  let fragment: string | null = null;
  const hashIndex = rest.indexOf("#");
  if (hashIndex !== -1) {
    fragment = rest.slice(hashIndex + 1);
    rest = rest.slice(0, hashIndex);
  }
  const queryIndex = rest.indexOf("?");
  if (queryIndex !== -1) {
    query = rest.slice(queryIndex + 1);
    rest = rest.slice(0, queryIndex);
  }
  return [rest, query, fragment];
}

/**
 * Parses a host. Returns null on failure.
 * IDN (non-ASCII hostnames) is not supported and fails.
 * IPv6 and IPv4 hosts are not normalized.
 */
function parseHost(input: string, special: boolean): string | null {
  if (input.startsWith("[")) {
    return /^\[[0-9a-fA-F:.]+\]$/.test(input) ? input.toLowerCase() : null;
  }
  if (!special) {
    if (/[\u0000\t\n\r #/:<>?@[\\\]^|]/.test(input)) return null;
    return encode(input, "");
  }
  const domain = percentDecode(input);
  if (/[^!-~]/.test(domain)) return null;
  if (/[#%/:<>?@[\\\]^|]/.test(domain)) return null;
  return domain.toLowerCase();
}

/** Parses a port. Returns null on failure, and an empty string for the default port. */
function parsePort(input: string, scheme: string): string | null {
  if (input === "") return "";
  if (!/^\d+$/.test(input)) return null;
  const port = Number(input);
  if (port > 65535) return null;
  const normalized = String(port);
  return normalized === SPECIAL_SCHEMES[scheme] ? "" : normalized;
}

/** Splits `host[:port]`. The port is null when there is no `:`. */
function splitHostPort(input: string): [host: string, port: string | null] | null {
  let hostEnd: number;
  if (input.startsWith("[")) {
    hostEnd = input.indexOf("]") + 1;
    if (hostEnd === 0) return null;
    if (hostEnd < input.length && input[hostEnd] !== ":") return null;
  } else {
    hostEnd = input.indexOf(":");
    if (hostEnd === -1) hostEnd = input.length;
  }
  const host = input.slice(0, hostEnd);
  const port = hostEnd < input.length ? input.slice(hostEnd + 1) : null;
  return [host, port];
}

function isSingleDot(segment: string): boolean {
  return segment === "." || segment.toLowerCase() === "%2e";
}

function isDoubleDot(segment: string): boolean {
  const s = segment.toLowerCase();
  return s === ".." || s === ".%2e" || s === "%2e." || s === "%2e%2e";
}

/** Parses a path, resolving `.` and `..` segments on top of `segments`. */
function parsePath(input: string, special: boolean, segments: string[] = []): string[] {
  let path = special ? input.replace(/\\/g, "/") : input;
  if (path === "") return special ? [""] : [];
  if (path.startsWith("/")) path = path.slice(1);
  const out = segments.slice();
  const parts = path.split("/");
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i]!;
    const isLast = i === parts.length - 1;
    if (isDoubleDot(segment)) {
      out.pop();
      if (isLast) out.push("");
    } else if (isSingleDot(segment)) {
      if (isLast) out.push("");
    } else {
      out.push(encode(segment, PATH_SET));
    }
  }
  return out;
}

function serializePath(path: string[] | string): string {
  return typeof path === "string" ? path : path.map((s) => "/" + s).join("");
}

/** Parses everything after `scheme://`. */
function parseAuthorityAndRest(scheme: string, input: string): URLRecord | null {
  const special = isSpecial(scheme);
  const [rest, query, fragment] = splitQueryAndFragment(input);
  const authorityEnd = special ? rest.search(/[/\\]/) : rest.indexOf("/");
  let authority = authorityEnd === -1 ? rest : rest.slice(0, authorityEnd);
  const pathInput = authorityEnd === -1 ? "" : rest.slice(authorityEnd);

  let username = "";
  let password = "";
  const atIndex = authority.lastIndexOf("@");
  if (atIndex !== -1) {
    const userinfo = authority.slice(0, atIndex);
    authority = authority.slice(atIndex + 1);
    if (authority === "") return null;
    const colonIndex = userinfo.indexOf(":");
    if (colonIndex === -1) {
      username = encode(userinfo, USERINFO_SET);
    } else {
      username = encode(userinfo.slice(0, colonIndex), USERINFO_SET);
      password = encode(userinfo.slice(colonIndex + 1), USERINFO_SET);
    }
  }

  const hostPort = splitHostPort(authority);
  if (!hostPort) return null;
  const [hostInput, portInput] = hostPort;
  if (hostInput === "" && (special || portInput !== null)) return null;
  const host = parseHost(hostInput, special);
  if (host === null) return null;
  const port = parsePort(portInput ?? "", scheme);
  if (port === null) return null;

  return {
    scheme,
    username,
    password,
    host,
    port,
    path: parsePath(pathInput, special),
    query: query === null ? null : encodeQuery(query, scheme),
    fragment: fragment === null ? null : encode(fragment, FRAGMENT_SET),
  };
}

function parseRelative(input: string, base: URLRecord): URLRecord | null {
  const special = isSpecial(base.scheme);
  if (typeof base.path === "string") {
    if (!input.startsWith("#")) return null;
    return { ...base, fragment: encode(input.slice(1), FRAGMENT_SET) };
  }

  const isSlash = (c: string | undefined) => c === "/" || (special && c === "\\");
  if (isSlash(input[0]) && isSlash(input[1])) {
    return parseAuthorityAndRest(
      base.scheme,
      special ? input.replace(/^[/\\]+/, "") : input.slice(2)
    );
  }

  const [pathInput, query, fragment] = splitQueryAndFragment(input);
  const record: URLRecord = { ...base, path: base.path.slice(), fragment: null };
  if (pathInput !== "") {
    record.path = isSlash(pathInput[0])
      ? parsePath(pathInput, special)
      : parsePath(pathInput, special, base.path.slice(0, -1));
    record.query = null;
  }
  if (query !== null) record.query = encodeQuery(query, base.scheme);
  if (fragment !== null) record.fragment = encode(fragment, FRAGMENT_SET);
  return record;
}

function parse(input: string, base?: URLRecord): URLRecord | null {
  const trimmed = input
    .replace(/^[\u0000- ]+|[\u0000- ]+$/g, "")
    .replace(/[\t\n\r]/g, "");

  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (!match) {
    return base ? parseRelative(trimmed, base) : null;
  }

  const scheme = match[1]!.toLowerCase();
  const rest = trimmed.slice(match[0].length);

  if (isSpecial(scheme)) {
    // e.g. `new URL("http:foo", "http://a/b")` is resolved relative to the base
    if (base && base.scheme === scheme && !/^[/\\]/.test(rest)) {
      return parseRelative(rest, base);
    }
    return parseAuthorityAndRest(scheme, rest.replace(/^[/\\]+/, ""));
  }

  if (rest.startsWith("//")) {
    return parseAuthorityAndRest(scheme, rest.slice(2));
  }

  const [pathInput, query, fragment] = splitQueryAndFragment(rest);
  return {
    scheme,
    username: "",
    password: "",
    host: null,
    port: "",
    path: pathInput.startsWith("/")
      ? parsePath(pathInput, false)
      : encode(pathInput, ""),
    query: query === null ? null : encodeQuery(query, scheme),
    fragment: fragment === null ? null : encode(fragment, FRAGMENT_SET),
  };
}

function serialize(record: URLRecord): string {
  let out = record.scheme + ":";
  if (record.host !== null) {
    out += "//";
    if (record.username !== "" || record.password !== "") {
      out += record.username;
      if (record.password !== "") out += ":" + record.password;
      out += "@";
    }
    out += record.host;
    if (record.port !== "") out += ":" + record.port;
  } else if (
    typeof record.path !== "string" &&
    record.path.length > 1 &&
    record.path[0] === ""
  ) {
    out += "/.";
  }
  out += serializePath(record.path);
  if (record.query !== null) out += "?" + record.query;
  if (record.fragment !== null) out += "#" + record.fragment;
  return out;
}

function stripNewlines(value: unknown): string {
  return String(value).replace(/[\t\n\r]/g, "");
}

/**
 * A minimal polyfill for the URL API.
 * https://url.spec.whatwg.org/#url-class
 *
 * Not supported: IDN/punycode (non-ASCII hostnames throw), IPv6/IPv4 normalization,
 * `file:` scheme specifics, and origins of non-special schemes such as `blob:`.
 */
export class URL {
  private _url: URLRecord;
  private readonly _searchParams: URLSearchParams;

  constructor(url: string | URL, base?: string | URL) {
    let baseRecord: URLRecord | undefined;
    if (base !== undefined) {
      const parsed = parse(String(base));
      if (!parsed) throw new TypeError(`Invalid URL: ${base}`);
      baseRecord = parsed;
    }
    const record = parse(String(url), baseRecord);
    if (!record) throw new TypeError(`Invalid URL: ${url}`);
    this._url = record;

    this._searchParams = new URLSearchParams();
    this._searchParams._replaceList(parseQuery(record.query));
    this._searchParams._onUpdate = () => {
      const query = this._searchParams.toString();
      this._url.query = query === "" ? null : query;
    };
  }

  /**
   * Returns true if the URL can be parsed.
   */
  static canParse(url: string | URL, base?: string | URL): boolean {
    try {
      new URL(url, base);
      return true;
    } catch {
      return false;
    }
  }

  private get _cannotHaveCredentialsOrPort(): boolean {
    return this._url.host === null || this._url.host === "";
  }

  get href(): string {
    return serialize(this._url);
  }

  set href(value: string) {
    const record = parse(String(value));
    if (!record) throw new TypeError(`Invalid URL: ${value}`);
    this._url = record;
    this._searchParams._replaceList(parseQuery(record.query));
  }

  get origin(): string {
    const { scheme, host, port } = this._url;
    if (!isSpecial(scheme)) return "null";
    return `${scheme}://${host}${port !== "" ? ":" + port : ""}`;
  }

  get protocol(): string {
    return this._url.scheme + ":";
  }

  set protocol(value: string) {
    const match = /^([a-zA-Z][a-zA-Z0-9+.-]*)(?::|$)/.exec(stripNewlines(value));
    if (!match) return;
    const scheme = match[1]!.toLowerCase();
    // Switching between special and non-special schemes is not allowed
    if (isSpecial(scheme) !== isSpecial(this._url.scheme)) return;
    this._url.scheme = scheme;
    if (this._url.port === SPECIAL_SCHEMES[scheme]) this._url.port = "";
  }

  get username(): string {
    return this._url.username;
  }

  set username(value: string) {
    if (this._cannotHaveCredentialsOrPort) return;
    this._url.username = encode(String(value), USERINFO_SET);
  }

  get password(): string {
    return this._url.password;
  }

  set password(value: string) {
    if (this._cannotHaveCredentialsOrPort) return;
    this._url.password = encode(String(value), USERINFO_SET);
  }

  get host(): string {
    const { host, port } = this._url;
    if (host === null) return "";
    return port !== "" ? `${host}:${port}` : host;
  }

  set host(value: string) {
    this._setHost(value, true);
  }

  get hostname(): string {
    return this._url.host ?? "";
  }

  set hostname(value: string) {
    this._setHost(value, false);
  }

  private _setHost(value: string, withPort: boolean): void {
    if (typeof this._url.path === "string") return;
    const special = isSpecial(this._url.scheme);
    let input = stripNewlines(value);
    const end = input.search(special ? /[/?#\\]/ : /[/?#]/);
    if (end !== -1) input = input.slice(0, end);

    const hostPort = splitHostPort(input);
    if (!hostPort) return;
    const [hostInput, portInput] = hostPort;
    if (!withPort && portInput !== null) return;
    if (hostInput === "" && special) return;
    const host = parseHost(hostInput, special);
    if (host === null) return;
    this._url.host = host;

    if (portInput !== null) {
      const digits = /^\d*/.exec(portInput)![0];
      if (digits === "") return;
      const port = parsePort(digits, this._url.scheme);
      if (port !== null) this._url.port = port;
    }
  }

  get port(): string {
    return this._url.port;
  }

  set port(value: string) {
    if (this._cannotHaveCredentialsOrPort) return;
    const input = stripNewlines(value);
    if (input === "") {
      this._url.port = "";
      return;
    }
    const digits = /^\d*/.exec(input)![0];
    if (digits === "") return;
    const port = parsePort(digits, this._url.scheme);
    if (port !== null) this._url.port = port;
  }

  get pathname(): string {
    return serializePath(this._url.path);
  }

  set pathname(value: string) {
    if (typeof this._url.path === "string") return;
    this._url.path = parsePath(stripNewlines(value), isSpecial(this._url.scheme));
  }

  get search(): string {
    const { query } = this._url;
    return query ? "?" + query : "";
  }

  set search(value: string) {
    let input = stripNewlines(value);
    if (input === "") {
      this._url.query = null;
      this._searchParams._replaceList([]);
      return;
    }
    if (input.startsWith("?")) input = input.slice(1);
    this._url.query = encodeQuery(input, this._url.scheme);
    this._searchParams._replaceList(parseQuery(this._url.query));
  }

  get searchParams(): URLSearchParams {
    return this._searchParams;
  }

  get hash(): string {
    const { fragment } = this._url;
    return fragment ? "#" + fragment : "";
  }

  set hash(value: string) {
    let input = stripNewlines(value);
    if (input === "") {
      this._url.fragment = null;
      return;
    }
    if (input.startsWith("#")) input = input.slice(1);
    this._url.fragment = encode(input, FRAGMENT_SET);
  }

  toString(): string {
    return this.href;
  }

  toJSON(): string {
    return this.href;
  }
}
