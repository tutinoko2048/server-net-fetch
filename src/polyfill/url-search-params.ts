export type URLSearchParamsInit =
  | string
  | Record<string, string>
  | [string, string][]
  | URLSearchParams;

/**
 * A polyfill for the URLSearchParams API.
 * https://url.spec.whatwg.org/#interface-urlsearchparams
 */
export class URLSearchParams {
  private _list: [string, string][] = [];

  constructor(init?: URLSearchParamsInit) {
    if (init != null) {
      if (typeof init === "string") {
        let str = init;
        if (str.startsWith("?")) {
          str = str.slice(1);
        }
        for (const pair of str.split("&")) {
          if (pair === "") continue;
          const index = pair.indexOf("=");
          if (index === -1) {
            this.append(this._decode(pair), "");
          } else {
            this.append(
              this._decode(pair.slice(0, index)),
              this._decode(pair.slice(index + 1))
            );
          }
        }
      } else if (Array.isArray(init)) {
        for (const pair of init) {
          if (pair.length !== 2) {
            throw new TypeError(
              "Failed to construct 'URLSearchParams': The sequence must contain exactly 2 elements."
            );
          }
          this.append(pair[0], pair[1]);
        }
      } else if (init instanceof URLSearchParams) {
        for (const [key, value] of init.entries()) {
          this.append(key, value);
        }
      } else if (typeof init === "object") {
        for (const [key, value] of Object.entries(init)) {
          this.append(key, value as string);
        }
      }
    }
  }

  private _decode(str: string): string {
    return decodeURIComponent(str.replace(/\+/g, " "));
  }

  private _encode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, "%21")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A")
      .replace(/\~/g, "%7E")
      .replace(/%20/g, "+");
  }

  /**
   * Appends a specified key/value pair as a new search parameter.
   */
  append(name: string, value: string): void {
    this._list.push([name, String(value)]);
  }

  /**
   * Deletes the given search parameter and its associated value,
   * from the list of all search parameters.
   */
  delete(name: string, value?: string): void {
    if (value !== undefined) {
      const v = String(value);
      this._list = this._list.filter(
        (pair) => pair[0] !== name || pair[1] !== v
      );
    } else {
      this._list = this._list.filter((pair) => pair[0] !== name);
    }
  }

  /**
   * Returns the first value associated to the given search parameter.
   */
  get(name: string): string | null {
    const pair = this._list.find((pair) => pair[0] === name);
    return pair ? pair[1] : null;
  }

  /**
   * Returns all the values associated with a given search parameter as an array.
   */
  getAll(name: string): string[] {
    return this._list.filter((pair) => pair[0] === name).map((pair) => pair[1]);
  }

  /**
   * Returns a boolean indicating if such a search parameter exists.
   */
  has(name: string, value?: string): boolean {
    if (value !== undefined) {
      const v = String(value);
      return this._list.some((pair) => pair[0] === name && pair[1] === v);
    }
    return this._list.some((pair) => pair[0] === name);
  }

  /**
   * Sets the value associated with a given search parameter to the given value.
   * If there were several matching values, this method deletes the others.
   * If the search parameter doesn't exist, this method creates it.
   */
  set(name: string, value: string): void {
    let found = false;
    const v = String(value);
    const newList: [string, string][] = [];
    for (const pair of this._list) {
      if (pair[0] === name) {
        if (!found) {
          newList.push([name, v]);
          found = true;
        }
      } else {
        newList.push(pair);
      }
    }
    if (!found) {
      newList.push([name, v]);
    }
    this._list = newList;
  }

  /**
   * Sorts all key/value pairs contained in this object directly and returns undefined.
   * The sort order is according to unicode code points of the keys.
   */
  sort(): void {
    this._list.sort((a, b) => {
      if (a[0] === b[0]) return 0;
      return a[0] < b[0] ? -1 : 1;
    });
  }

  /**
   * Returns a string containing a query string suitable for use in a URL.
   */
  toString(): string {
    return this._list
      .map((pair) => `${this._encode(pair[0])}=${this._encode(pair[1])}`)
      .join("&");
  }

  /**
   * Allows iteration through all values contained in this object via a callback function.
   */
  forEach(
    callback: (value: string, key: string, parent: URLSearchParams) => void,
    thisArg?: any
  ): void {
    for (const [key, value] of this._list) {
      callback.call(thisArg, value, key, this);
    }
  }

  /**
   * Returns an ES6 iterator allowing iteration through all character keys contained in this object.
   */
  *keys(): IterableIterator<string> {
    for (const [key] of this._list) {
      yield key;
    }
  }

  /**
   * Returns an ES6 iterator allowing iteration through all values contained in this object.
   */
  *values(): IterableIterator<string> {
    for (const [, value] of this._list) {
      yield value;
    }
  }

  /**
   * Returns an ES6 iterator allowing to go through all key/value pairs contained in this object.
   */
  *entries(): IterableIterator<[string, string]> {
    for (const pair of this._list) {
      yield [pair[0], pair[1]];
    }
  }

  /**
   * ES6 Iterator implementation.
   */
  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  /**
   * Indicates the total number of search parameter entries.
   */
  get size(): number {
    return this._list.length;
  }
}
