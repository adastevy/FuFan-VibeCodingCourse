import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// These tests cover the DB-reading helpers added to contract.ts.
// They use a fake NANOCLAW_ROOT pointing to a nonexistent path so the
// "no db" code-path is exercised without requiring a real NanoClaw install.

// We reset the module between tests so the cached _resolvedRoot is cleared.
describe("readRecentDailyNews", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NANOCLAW_ROOT", "/nonexistent/fake-nanoclaw-root");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty array when central db does not exist", async () => {
    const { readRecentDailyNews } = await import("@/lib/nanoclaw/contract");
    const result = readRecentDailyNews(10);
    expect(result).toEqual([]);
  });

  it("returns empty array when limit is 0 and db does not exist", async () => {
    const { readRecentDailyNews } = await import("@/lib/nanoclaw/contract");
    const result = readRecentDailyNews(0);
    expect(result).toEqual([]);
  });
});

describe("readDailyNewsTask", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NANOCLAW_ROOT", "/nonexistent/fake-nanoclaw-root");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when sessions root does not exist", async () => {
    const { readDailyNewsTask } = await import("@/lib/nanoclaw/contract");
    const result = readDailyNewsTask();
    expect(result).toBeNull();
  });
});
