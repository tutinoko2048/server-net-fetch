import { describe, test, expect } from "bun:test";
import { URLSearchParams } from "./url-search-params";

describe("URLSearchParams", () => {
  test("Constructor initialization", () => {
    // Empty
    expect(new URLSearchParams().size).toBe(0);

    // String
    expect(new URLSearchParams("a=1&b=2").get("a")).toBe("1");
    expect(new URLSearchParams("?a=1&b=2").get("b")).toBe("2");

    // Array
    expect(new URLSearchParams([["a", "1"], ["b", "2"]]).get("b")).toBe("2");

    // Object
    expect(new URLSearchParams({ a: "1", b: "2" }).get("a")).toBe("1");

    // Existing URLSearchParams
    const existing = new URLSearchParams("a=1&b=2");
    expect(new URLSearchParams(existing).get("b")).toBe("2");
  });

  test("append()", () => {
    const params = new URLSearchParams();
    params.append("a", "1");
    params.append("a", "2");
    expect(params.getAll("a")).toEqual(["1", "2"]);
    expect(params.size).toBe(2);
  });

  test("delete()", () => {
    const params = new URLSearchParams([
      ["a", "1"],
      ["a", "2"],
      ["b", "3"],
    ]);

    // Test base delete
    params.delete("a");
    expect(params.has("a")).toBe(false);
    expect(params.has("b")).toBe(true);
    expect(params.size).toBe(1);

    // Test delete specific value (if supported)
    params.append("x", "1");
    params.append("x", "2");
    params.delete("x", "1");
    expect(params.getAll("x")).toEqual(["2"]);
  });

  test("get() and getAll()", () => {
    const params = new URLSearchParams("a=1&a=2&b=3&c=");
    expect(params.get("a")).toBe("1");
    expect(params.get("b")).toBe("3");
    expect(params.get("c")).toBe("");
    expect(params.get("d")).toBe(null);

    expect(params.getAll("a")).toEqual(["1", "2"]);
    expect(params.getAll("d")).toEqual([]);
  });

  test("has()", () => {
    const params = new URLSearchParams("a=1&a=2&b=3");
    expect(params.has("a")).toBe(true);
    expect(params.has("c")).toBe(false);

    expect(params.has("a", "2")).toBe(true);
    expect(params.has("a", "3")).toBe(false);
  });

  test("set()", () => {
    const params = new URLSearchParams("a=1&a=2&b=3");
    params.set("a", "4");
    expect(params.getAll("a")).toEqual(["4"]);

    params.set("c", "5");
    expect(params.get("c")).toBe("5");
    expect(params.size).toBe(3); // a=4, b=3, c=5
  });

  test("sort()", () => {
    const params = new URLSearchParams("c=3&a=1&b=2&a=0");
    params.sort();
    expect(params.toString()).toBe("a=1&a=0&b=2&c=3");
  });

  test("toString()", () => {
    const params = new URLSearchParams();
    params.append("foo", "bar");
    params.append("space test", "1 2");
    params.append("symbols", "!@#$%^&*()");

    const str = params.toString();
    expect(str).toBe("foo=bar&space+test=1+2&symbols=%21%40%23%24%25%5E%26%2A%28%29");
  });

  test("Iterators (forEach, keys, values, entries, Symbol.iterator)", () => {
    const params = new URLSearchParams("a=1&b=2");

    // forEach
    let keys: string[] = [];
    let vals: string[] = [];
    params.forEach((v, k) => {
      keys.push(k);
      vals.push(v);
    });
    expect(keys).toEqual(["a", "b"]);
    expect(vals).toEqual(["1", "2"]);

    // keys()
    expect(Array.from(params.keys())).toEqual(["a", "b"]);

    // values()
    expect(Array.from(params.values())).toEqual(["1", "2"]);

    // entries()
    expect(Array.from(params.entries())).toEqual([["a", "1"], ["b", "2"]]);

    // Symbol.iterator
    expect(Array.from(params)).toEqual([["a", "1"], ["b", "2"]]);
  });
});
