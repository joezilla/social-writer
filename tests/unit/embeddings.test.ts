import { describe, it, expect, vi, beforeEach } from "vitest";
import { cosineSimilarity, embed } from "@/lib/embeddings";

vi.mock("@/lib/settings", () => ({
  requireSetting: vi.fn().mockResolvedValue("test-openai-key"),
}));

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });

  it("handles high-dimensional vectors", () => {
    const a = new Array(1536).fill(0.5);
    const b = new Array(1536).fill(0.5);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });
});

describe("embed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls OpenAI API and returns sorted embeddings", async () => {
    const mockEmbedding1 = [0.1, 0.2, 0.3];
    const mockEmbedding2 = [0.4, 0.5, 0.6];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { index: 1, embedding: mockEmbedding2 },
            { index: 0, embedding: mockEmbedding1 },
          ],
        }),
    }) as unknown as typeof fetch;

    const result = await embed(["text1", "text2"]);

    expect(result).toEqual([mockEmbedding1, mockEmbedding2]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("Invalid API key"),
    }) as unknown as typeof fetch;

    await expect(embed(["test"])).rejects.toThrow("OpenAI embedding failed");
  });
});
