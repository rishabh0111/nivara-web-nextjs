import { describe, expect, it } from "vitest";

import { resolveApiEndpoints } from "./api";

describe("resolveApiEndpoints", () => {
  it("points HTTP, the socket and the OpenAPI document at the one URL it was given", () => {
    const endpoints = resolveApiEndpoints("https://nivara-api-nestjs.onrender.com");

    expect(endpoints).toEqual({
      httpBaseUrl: "https://nivara-api-nestjs.onrender.com",
      realtimeUrl: "https://nivara-api-nestjs.onrender.com/rt",
      openApiDocumentUrl: "https://nivara-api-nestjs.onrender.com/openapi.json",
    });
  });

  it("moves every endpoint together when the URL changes", () => {
    const endpoints = resolveApiEndpoints("http://localhost:3333");

    expect(endpoints.httpBaseUrl).toBe("http://localhost:3333");
    expect(endpoints.realtimeUrl).toBe("http://localhost:3333/rt");
    expect(endpoints.openApiDocumentUrl).toBe("http://localhost:3333/openapi.json");
  });

  it("tolerates a trailing slash rather than emitting a doubled one", () => {
    const endpoints = resolveApiEndpoints("https://example.test/");

    expect(endpoints.httpBaseUrl).toBe("https://example.test");
    expect(endpoints.realtimeUrl).toBe("https://example.test/rt");
  });

  it("names the variable when it is missing", () => {
    expect(() => resolveApiEndpoints(undefined)).toThrowError(/NEXT_PUBLIC_API_URL/);
    expect(() => resolveApiEndpoints("   ")).toThrowError(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a value that is not an absolute http URL", () => {
    expect(() => resolveApiEndpoints("nivara-api-nestjs.onrender.com")).toThrowError(
      /NEXT_PUBLIC_API_URL/,
    );
    expect(() => resolveApiEndpoints("ws://example.test")).toThrowError(/NEXT_PUBLIC_API_URL/);
  });
});
