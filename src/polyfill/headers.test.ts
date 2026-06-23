import { describe, expect, test } from "bun:test";
import { Headers as Headers } from "./headers";

describe("Headers", () => {
  test("Constructor initialization", () => {
    // Empty
    const empty = new Headers();
    expect(empty.entries()).toEqual([]);

    // Object
    const fromObject = new Headers({ Foo: "bar", "X-Test": "123" });
    expect(fromObject.get("foo")).toBe("bar");
    expect(fromObject.get("x-test")).toBe("123");

    // Array
    const fromArray = new Headers([
      ["Foo", "bar"],
      ["X-Test", "123"],
    ]);
    expect(fromArray.get("foo")).toBe("bar");

    // Headers
    const existing = new Headers({ original: "value" });
    const fromHeaders = new Headers(existing);
    expect(fromHeaders.get("original")).toBe("value");
  });

  test("set() and get() are case-insensitive", () => {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");

    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("CONTENT-TYPE")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");

    // Overwrite existing key
    headers.set("content-type", "text/plain");
    expect(headers.get("Content-Type")).toBe("text/plain");

    // Non-existent key
    expect(headers.get("Missing-Key")).toBeUndefined();
  });

  test("has() works case-insensitively", () => {
    const headers = new Headers({ "X-Custom": "test" });
    expect(headers.has("x-custom")).toBe(true);
    expect(headers.has("X-CUSTOM")).toBe(true);
    expect(headers.has("missing")).toBe(false);
  });

  test("entries() returns array of key-value tuples", () => {
    const headers = new Headers({ Foo: "bar", Baz: "qux" });
    const entries = headers.entries().sort(([a], [b]) => a.localeCompare(b));
    expect(entries).toEqual([
      ["baz", "qux"],
      ["foo", "bar"],
    ]);
  });

  test("toObject() returns a plain Record with lowercase keys", () => {
    const headers = new Headers({ Custom: "Value1", "X-Test": "Value2" });
    expect(headers.toObject()).toEqual({
      custom: "Value1",
      "x-test": "Value2",
    });
  });
});
