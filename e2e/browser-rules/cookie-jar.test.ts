import { describe, expect, it } from "vitest";

import { CookieJar, describeCookies } from "./cookie-jar";

const crossSite = () => new CookieJar();

const refresh = (attributes: string) => `nvd_refresh=abc123; ${attributes}`;

describe("a cookie jar under cross-site rules", () => {
  it("sends a SameSite=None; Secure cookie back to the path it was scoped to", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/auth; HttpOnly; Secure; SameSite=None")]);

    expect(jar.header("/auth/refresh")).toBe("nvd_refresh=abc123");
  });

  it("withholds a Lax cookie, because this request is cross-site", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/auth; HttpOnly; Secure; SameSite=Lax")]);

    expect(jar.header("/auth/refresh")).toBeUndefined();
    expect(jar.withheld("/auth/refresh").map((cookie) => cookie.name)).toEqual(["nvd_refresh"]);
  });

  it("withholds SameSite=None without Secure, which no browser stores at all", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/auth; SameSite=None")]);

    expect(jar.header("/auth/refresh")).toBeUndefined();
    expect(jar.withheld("/auth/refresh")).toHaveLength(1);
  });

  it("defaults an unstated SameSite to Lax, as a browser does", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/auth; Secure")]);

    expect(jar.header("/auth/refresh")).toBeUndefined();
  });

  it("does not send a cookie scoped to a path this request is not under", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/portal/auth; Secure; SameSite=None")]);

    expect(jar.header("/auth/refresh")).toBeUndefined();
    expect(jar.withheld("/auth/refresh")).toHaveLength(0);
  });

  it("matches a path only on a segment boundary", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/auth; Secure; SameSite=None")]);

    expect(jar.header("/auth")).toBe("nvd_refresh=abc123");
    expect(jar.header("/authorised/thing")).toBeUndefined();
  });

  it("holds the Portal's and the Dashboard's refresh cookies apart", () => {
    const jar = crossSite();
    jar.accept([
      "nvd_refresh=staff; Path=/auth; Secure; SameSite=None",
      "nvd_portal_refresh=contact; Path=/portal/auth; Secure; SameSite=None",
    ]);

    expect(jar.header("/auth/refresh")).toBe("nvd_refresh=staff");
    expect(jar.header("/portal/auth/refresh")).toBe("nvd_portal_refresh=contact");
  });

  it("replaces a cookie the server set again on the same name and path", () => {
    const jar = crossSite();
    jar.accept(["nvd_refresh=first; Path=/auth; Secure; SameSite=None"]);
    jar.accept(["nvd_refresh=second; Path=/auth; Secure; SameSite=None"]);

    expect(jar.header("/auth/refresh")).toBe("nvd_refresh=second");
  });

  it("sends several matching cookies in one header", () => {
    const jar = crossSite();
    jar.accept([
      "a=1; Path=/; Secure; SameSite=None",
      "b=2; Path=/auth; Secure; SameSite=None",
    ]);

    expect(jar.header("/auth/refresh")).toBe("a=1; b=2");
  });

  it("ignores a Set-Cookie with nothing before the first equals sign", () => {
    const jar = crossSite();
    jar.accept(["; Path=/auth; Secure; SameSite=None"]);

    expect(jar.header("/auth/refresh")).toBeUndefined();
  });
});

describe("naming cookies in a diagnosis", () => {
  it("names each one with the two attributes that decided its fate", () => {
    const jar = crossSite();
    jar.accept([refresh("Path=/auth; Secure; SameSite=Lax")]);

    expect(describeCookies(jar.withheld("/auth/refresh"))).toBe(
      "nvd_refresh (SameSite=lax; Secure)",
    );
  });

  it("says so plainly where there are none", () => {
    expect(describeCookies([])).toBe("none");
  });
});
