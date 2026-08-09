import { describe, expect, it } from "vitest";

import { corsRefusal, preflightRefusal, preflightRequired } from "./cors";

const ORIGIN = "http://localhost:3000";

const headers = (entries: Record<string, string>): Headers => new Headers(entries);

describe("what a browser does with a response", () => {
  it("accepts a response that names this exact origin and allows credentials", () => {
    expect(
      corsRefusal({
        origin: ORIGIN,
        credentialed: true,
        headers: headers({
          "access-control-allow-origin": ORIGIN,
          "access-control-allow-credentials": "true",
        }),
      }),
    ).toBeUndefined();
  });

  it("refuses a response with no allow-origin at all", () => {
    const refusal = corsRefusal({ origin: ORIGIN, credentialed: false, headers: headers({}) });

    expect(refusal?.header).toBe("access-control-allow-origin");
  });

  it("refuses a response that names somebody else's origin", () => {
    const refusal = corsRefusal({
      origin: ORIGIN,
      credentialed: false,
      headers: headers({ "access-control-allow-origin": "https://elsewhere.test" }),
    });

    expect(refusal?.header).toBe("access-control-allow-origin");
  });

  it("accepts a wildcard where no credential is involved", () => {
    expect(
      corsRefusal({
        origin: ORIGIN,
        credentialed: false,
        headers: headers({ "access-control-allow-origin": "*" }),
      }),
    ).toBeUndefined();
  });

  it("refuses a wildcard on a credentialed request", () => {
    const refusal = corsRefusal({
      origin: ORIGIN,
      credentialed: true,
      headers: headers({
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "true",
      }),
    });

    expect(refusal?.header).toBe("access-control-allow-origin");
  });

  it("refuses a credentialed request the response did not allow credentials on", () => {
    const refusal = corsRefusal({
      origin: ORIGIN,
      credentialed: true,
      headers: headers({ "access-control-allow-origin": ORIGIN }),
    });

    expect(refusal?.header).toBe("access-control-allow-credentials");
  });
});

describe("which requests are preflighted", () => {
  it("does not preflight a bare GET", () => {
    expect(preflightRequired("GET", headers({ accept: "application/json" }))).toBe(false);
  });

  it("preflights anything carrying a credential", () => {
    expect(preflightRequired("GET", headers({ authorization: "Bearer nvw_x" }))).toBe(true);
  });

  it("preflights a JSON body, because that content type is not on the safelist", () => {
    expect(preflightRequired("POST", headers({ "content-type": "application/json" }))).toBe(true);
  });

  it("preflights a method outside the simple three", () => {
    expect(preflightRequired("PATCH", headers({}))).toBe(true);
  });
});

describe("what a browser does with a preflight", () => {
  const allowed = headers({
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH",
    "access-control-allow-headers": "authorization,content-type",
  });

  it("accepts a preflight that allows the method and every requested header", () => {
    expect(
      preflightRefusal({
        origin: ORIGIN,
        credentialed: true,
        method: "POST",
        requestedHeaders: ["authorization", "content-type"],
        status: 204,
        headers: allowed,
      }),
    ).toBeUndefined();
  });

  it("refuses a preflight the API answered with an error status", () => {
    const refusal = preflightRefusal({
      origin: ORIGIN,
      credentialed: true,
      method: "POST",
      requestedHeaders: [],
      status: 404,
      headers: allowed,
    });

    expect(refusal?.header).toBe("status");
  });

  it("refuses a preflight that does not allow the method", () => {
    const refusal = preflightRefusal({
      origin: ORIGIN,
      credentialed: true,
      method: "DELETE",
      requestedHeaders: [],
      status: 204,
      headers: allowed,
    });

    expect(refusal?.header).toBe("access-control-allow-methods");
  });

  it("refuses a preflight that leaves a requested header out", () => {
    const refusal = preflightRefusal({
      origin: ORIGIN,
      credentialed: true,
      method: "POST",
      requestedHeaders: ["authorization", "x-invented"],
      status: 204,
      headers: allowed,
    });

    expect(refusal?.header).toBe("access-control-allow-headers");
    expect(refusal?.reason).toContain("x-invented");
  });

  it("reads the allow lists case-insensitively, as a browser does", () => {
    expect(
      preflightRefusal({
        origin: ORIGIN,
        credentialed: true,
        method: "post",
        requestedHeaders: ["Authorization"],
        status: 204,
        headers: allowed,
      }),
    ).toBeUndefined();
  });

  it("refuses a wildcard header list on a credentialed preflight", () => {
    const refusal = preflightRefusal({
      origin: ORIGIN,
      credentialed: true,
      method: "POST",
      requestedHeaders: ["authorization"],
      status: 204,
      headers: headers({
        "access-control-allow-origin": ORIGIN,
        "access-control-allow-credentials": "true",
        "access-control-allow-methods": "GET,POST",
        "access-control-allow-headers": "*",
      }),
    });

    expect(refusal?.header).toBe("access-control-allow-headers");
  });
});
