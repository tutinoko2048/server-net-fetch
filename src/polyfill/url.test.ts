import { describe, test, expect } from "bun:test";
import { hc } from "hono/client";
import { URL } from "./url";

const NativeURL = globalThis.URL;

describe("URL", () => {
  test("Absolute URL properties", () => {
    const url = new URL("https://user:pass@Example.COM:8443/a/b?x=1#h");
    expect(url.href).toBe("https://user:pass@example.com:8443/a/b?x=1#h");
    expect(url.protocol).toBe("https:");
    expect(url.username).toBe("user");
    expect(url.password).toBe("pass");
    expect(url.host).toBe("example.com:8443");
    expect(url.hostname).toBe("example.com");
    expect(url.port).toBe("8443");
    expect(url.pathname).toBe("/a/b");
    expect(url.search).toBe("?x=1");
    expect(url.hash).toBe("#h");
    expect(url.origin).toBe("https://example.com:8443");
    expect(url.toString()).toBe(url.href);
    expect(url.toJSON()).toBe(url.href);
    expect(JSON.stringify({ url })).toBe(`{"url":"${url.href}"}`);
  });

  test("Default port and empty path", () => {
    const url = new URL("http://a.com:80/");
    expect(url.port).toBe("");
    expect(url.href).toBe("http://a.com/");

    expect(new URL("https://a.com:443").href).toBe("https://a.com/");
    expect(new URL("ws://a.com:80").port).toBe("");
    expect(new URL("wss://a.com:443").port).toBe("");
    expect(new URL("http://a.com").pathname).toBe("/");
    expect(new URL("HTTP://A.com").protocol).toBe("http:");
  });

  test("Relative resolution", () => {
    expect(new URL("../c?y=2", "https://a.com/x/y/z").href).toBe("https://a.com/x/c?y=2");
    expect(new URL("/abs", "https://a.com/x/y").href).toBe("https://a.com/abs");
    expect(new URL("rel", "https://a.com/x/y").href).toBe("https://a.com/x/rel");
    expect(new URL("./rel", "https://a.com/x/y").href).toBe("https://a.com/x/rel");
    expect(new URL("?q", "https://a.com/x/y?z#f").href).toBe("https://a.com/x/y?q");
    expect(new URL("#h", "https://a.com/x/y?z#f").href).toBe("https://a.com/x/y?z#h");
    expect(new URL("//b.com/p", "https://a.com/x").href).toBe("https://b.com/p");
    expect(new URL("https://b.com/p", "https://a.com/x").href).toBe("https://b.com/p");

    const base = new URL("https://a.com/x/y");
    expect(new URL("z", base).href).toBe("https://a.com/x/z");
    expect(new URL(base).href).toBe(base.href);
  });

  test("Dot segments", () => {
    expect(new URL("http://a.com/a/./b/../c/.").pathname).toBe("/a/c/");
    expect(new URL("http://a.com/a/%2e/b/%2E%2e/c").pathname).toBe("/a/c");
    expect(new URL("http://a.com/../../x").pathname).toBe("/x");
    expect(new URL("http://a.com/a/b/..").pathname).toBe("/a/");
  });

  test("Invalid input", () => {
    const invalid: [string, string?][] = [
      ["foo"],
      ["/relative"],
      ["//a.com"],
      ["http://"],
      ["http://:80/"],
      ["http://a.com:99999/"],
      ["http://a.com:8x/"],
      ["http://a b.com/"],
      ["http://user@/x"],
      ["http://日本.jp/"],
      ["x", "bad base"],
      ["x", "mailto:a@b"],
    ];
    for (const [input, base] of invalid) {
      expect(() => new URL(input, base)).toThrow(TypeError);
      expect(URL.canParse(input, base)).toBe(false);
    }
    expect(() => new URL("foo")).toThrow("Invalid URL: foo");
    expect(URL.canParse("https://a.com")).toBe(true);
    expect(URL.canParse("/x", "https://a.com")).toBe(true);
  });

  test("searchParams sync", () => {
    const url = new URL("https://a.com/?a=1");
    expect(url.searchParams.get("a")).toBe("1");

    url.search = "?b=2&c=3";
    expect(url.searchParams.get("a")).toBeNull();
    expect(url.searchParams.get("b")).toBe("2");

    url.searchParams.set("b", "x y");
    expect(url.search).toBe("?b=x+y&c=3");
    expect(url.href).toBe("https://a.com/?b=x+y&c=3");

    url.searchParams.append("d", "4");
    url.searchParams.delete("c");
    expect(url.href).toBe("https://a.com/?b=x+y&d=4");

    url.searchParams.sort();
    url.searchParams.delete("b");
    url.searchParams.delete("d");
    expect(url.search).toBe("");
    expect(url.href).toBe("https://a.com/");

    url.search = "";
    expect(url.searchParams.size).toBe(0);

    url.href = "https://b.com/?q=1";
    expect(url.searchParams.get("q")).toBe("1");

    // Malformed percent-encoding does not throw
    expect(new URL("https://a.com/?a=%zz").searchParams.get("a")).toBe("%zz");
  });

  test("Percent-encoding", () => {
    const url = new URL("http://a.com/パス with space?q=日本 語#frag ment");
    expect(url.pathname).toBe("/%E3%83%91%E3%82%B9%20with%20space");
    expect(url.search).toBe("?q=%E6%97%A5%E6%9C%AC%20%E8%AA%9E");
    expect(url.hash).toBe("#frag%20ment");
    expect(url.searchParams.get("q")).toBe("日本 語");

    // Already encoded parts are not encoded twice
    expect(new URL("http://a.com/%E3%81%82%20?a=%41").href).toBe(
      "http://a.com/%E3%81%82%20?a=%41"
    );
  });

  test("Setters", () => {
    const url = new URL("http://a.com/x");
    url.protocol = "https";
    url.host = "B.com:8443";
    url.pathname = "a b/../c";
    url.search = "q=1";
    url.hash = "top";
    url.username = "u";
    url.password = "p";
    expect(url.href).toBe("https://u:p@b.com:8443/c?q=1#top");

    url.port = "443";
    expect(url.port).toBe("");
    url.hostname = "c.com";
    expect(url.host).toBe("c.com");
    url.hash = "";
    expect(url.href).toBe("https://u:p@c.com/c?q=1");

    expect(() => {
      url.href = "invalid";
    }).toThrow(TypeError);
  });

  test("Non-special schemes", () => {
    const mailto = new URL("mailto:a@b.com?subject=hi");
    expect(mailto.pathname).toBe("a@b.com");
    expect(mailto.host).toBe("");
    expect(mailto.origin).toBe("null");

    const foo = new URL("foo://Host/a/../b");
    expect(foo.hostname).toBe("Host");
    expect(foo.pathname).toBe("/b");
  });

  test("instanceof", () => {
    expect(new URL("https://a.com") instanceof URL).toBe(true);
  });

  test("hono client $url()", () => {
    const original = globalThis.URL;
    // @ts-expect-error
    globalThis.URL = URL;
    try {
      const client: any = hc("https://example.com/api");
      const url = client.users[":id"].$url({
        param: { id: "42" },
        query: { q: "a b", page: "2" },
      });
      expect(url).toBeInstanceOf(URL);
      expect(url.href).toBe("https://example.com/api/users/42?q=a+b&page=2");
      expect(url.searchParams.get("q")).toBe("a b");
    } finally {
      globalThis.URL = original;
    }
  });

  test("Matches native URL", () => {
    const keys = [
      "href", "protocol", "username", "password", "host", "hostname",
      "port", "pathname", "search", "hash", "origin",
    ] as const;
    const cases: [string, string?][] = [
      ["https://user:pass@Example.COM:8443/a/b?x=1#h"],
      ["HTTP://A.com:0080/x"],
      ["../c?y=2", "https://a.com/x/y/z"],
      ["", "https://a.com/x?y#z"],
      ["http://a.com/a/./b/../c/."],
      ["http://a.com/パス with space?q=日本 語&x='\"#frag ment`"],
      ["http://a.com/^{}|`?a=b c^{}|`<>"],
      ["http:\\\\a.com\\b\\c"],
      ["http:x", "http://a.com/b/c"],
      ["  http://a.com/\t\nx  "],
      ["foo://Host/a/../b?q'#f"],
      ["mailto:a@b.com?subject=hi there"],
      ["http://a@b@c.com/"],
      ["http://[::1]:8080/"],
    ];
    for (const [input, base] of cases) {
      const actual = new URL(input, base);
      const expected = new NativeURL(input, base);
      for (const key of keys) {
        expect(actual[key]).toBe(expected[key]);
      }
    }
  });
});
