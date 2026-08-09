import { describe, expect, it } from "vitest";

import { readLiveEnvironment, SHOWCASE_TENANT_ID } from "./environment";

const complete = {
  NEXT_PUBLIC_API_URL: "https://nivara-api-nestjs.onrender.com",
  NIVARA_E2E_TENANT_ID: "5eed0000-0000-4000-8000-000000000002",
  NIVARA_E2E_EMAIL: "admin@sortwood.test",
  NIVARA_E2E_PASSWORD: "hunter2",
};

describe("what the live path needs before it runs", () => {
  it("reads the API, the origin and the credential from the environment", () => {
    const read = readLiveEnvironment({ ...complete, NIVARA_E2E_ORIGIN: "https://nivara-web.test" });

    expect(read.ready && read.environment).toMatchObject({
      origin: "https://nivara-web.test",
      credentials: { tenantId: complete.NIVARA_E2E_TENANT_ID, email: "admin@sortwood.test" },
    });
    expect(read.ready && read.environment.endpoints.realtimeUrl).toBe(
      "https://nivara-api-nestjs.onrender.com/rt",
    );
  });

  it("stands in localhost for the origin, which is the one a developer runs on", () => {
    const read = readLiveEnvironment(complete);

    expect(read.ready && read.environment.origin).toBe("http://localhost:3000");
  });

  it("is not ready when a credential is missing, and names what is absent", () => {
    const read = readLiveEnvironment({ ...complete, NIVARA_E2E_PASSWORD: undefined });

    expect(read.ready).toBe(false);
    expect(read.ready === false && read.reason).toContain("NIVARA_E2E_PASSWORD");
  });

  it("is not ready when no API is configured", () => {
    const read = readLiveEnvironment({ ...complete, NEXT_PUBLIC_API_URL: undefined });

    expect(read.ready).toBe(false);
    expect(read.ready === false && read.reason).toContain("NEXT_PUBLIC_API_URL");
  });

  it("refuses the showcase Tenant outright, because this path writes", () => {
    const read = readLiveEnvironment({ ...complete, NIVARA_E2E_TENANT_ID: SHOWCASE_TENANT_ID });

    expect(read.ready).toBe(false);
    expect(read.ready === false && read.reason).toContain("showcase");
  });

  it("takes a cold-start budget, and is generous by default", () => {
    const budgeted = readLiveEnvironment({ ...complete, NIVARA_E2E_COLD_START_MS: "5000" });
    const default_ = readLiveEnvironment(complete);

    expect(budgeted.ready && budgeted.environment.coldStartBudgetMs).toBe(5000);
    expect(default_.ready && default_.environment.coldStartBudgetMs).toBe(120_000);
  });
});
