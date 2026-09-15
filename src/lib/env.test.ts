import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("environment configuration", () => {
  it("ignores MongoDB settings when the document store is disabled", async () => {
    vi.stubEnv("NOSQL_PROVIDER", "disabled");
    vi.stubEnv("MONGODB_URI", "not-a-mongodb-uri");
    vi.stubEnv("MONGODB_DATABASE", "not a database name");
    vi.stubEnv("NOSQL_EVENT_RETENTION_DAYS", "0");

    const { env } = await import("./env");

    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.MONGODB_DATABASE).toBe("lunaria");
    expect(env.NOSQL_EVENT_RETENTION_DAYS).toBe(90);
  });

  it("rejects invalid MongoDB settings when the document store is enabled", async () => {
    vi.stubEnv("NOSQL_PROVIDER", "mongodb");
    vi.stubEnv("MONGODB_URI", "not-a-mongodb-uri");
    vi.stubEnv("MONGODB_DATABASE", "not a database name");
    vi.stubEnv("NOSQL_EVENT_RETENTION_DAYS", "0");

    await expect(import("./env")).rejects.toThrow(
      "Invalid environment configuration",
    );
  });
});
