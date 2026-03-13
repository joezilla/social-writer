import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/settings", () => ({
  requireSetting: vi.fn().mockResolvedValue("test-exa-key"),
}));

describe("exa", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchExa", () => {
    it("maps API results to ExaResult shape", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                title: "Test Article",
                url: "https://example.com/article",
                text: "Article excerpt",
                publishedDate: "2026-01-01",
              },
            ],
          }),
      }) as unknown as typeof fetch;

      const { searchExa } = await import("@/lib/exa");
      const results = await searchExa("test query");

      expect(results).toEqual([
        {
          title: "Test Article",
          url: "https://example.com/article",
          excerpt: "Article excerpt",
          publishedDate: "2026-01-01",
        },
      ]);
    });

    it("throws on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("API error"),
      }) as unknown as typeof fetch;

      const { searchExa } = await import("@/lib/exa");
      await expect(searchExa("query")).rejects.toThrow("Exa search failed");
    });
  });

  describe("searchMultipleQueries", () => {
    it("deduplicates results by URL", async () => {
      const sharedResult = {
        title: "Shared",
        url: "https://example.com/shared",
        text: "shared text",
        publishedDate: null,
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                sharedResult,
                {
                  title: `Unique ${callCount}`,
                  url: `https://example.com/unique-${callCount}`,
                  text: "text",
                  publishedDate: null,
                },
              ],
            }),
        });
      }) as unknown as typeof fetch;

      const { searchMultipleQueries } = await import("@/lib/exa");
      const results = await searchMultipleQueries(["q1", "q2"]);

      const urls = results.map((r) => r.url);
      expect(urls.filter((u) => u === "https://example.com/shared")).toHaveLength(1);
      expect(results.length).toBe(3);
    });

    it("continues on partial failure", async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            text: () => Promise.resolve("error"),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ title: "OK", url: "https://ok.com", text: "ok", publishedDate: null }],
            }),
        });
      }) as unknown as typeof fetch;

      const { searchMultipleQueries } = await import("@/lib/exa");
      const results = await searchMultipleQueries(["fail-query", "ok-query"]);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("OK");
    });
  });
});
