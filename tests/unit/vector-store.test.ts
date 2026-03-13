import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { USER_A, USER_B } from "../helpers/fixtures";

vi.mock("@/lib/embeddings", () => ({
  embed: vi.fn(),
  embedSingle: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

describe("vector-store", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
    // Clear globalThis cache
    const g = globalThis as Record<string, unknown>;
    delete g.embeddingCache;
  });

  describe("querySimilarContent", () => {
    it("returns entries ranked by similarity", async () => {
      const { embedSingle, cosineSimilarity } = await import("@/lib/embeddings");
      vi.mocked(embedSingle).mockResolvedValue([0.1, 0.2, 0.3]);
      vi.mocked(cosineSimilarity)
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.7);

      mockPrisma.voiceCorpusEntry.findMany.mockResolvedValue([
        { id: "1", content: "high", source: "blog", title: null, embedding: Buffer.from("[0.1,0.2,0.3]") },
        { id: "2", content: "low", source: "blog", title: null, embedding: Buffer.from("[0.4,0.5,0.6]") },
        { id: "3", content: "mid", source: "blog", title: null, embedding: Buffer.from("[0.7,0.8,0.9]") },
      ]);

      const { querySimilarContent } = await import("@/lib/vector-store");
      const results = await querySimilarContent("test query", 3, USER_A.id);

      expect(results[0].content).toBe("high");
      expect(results[0].similarity).toBe(0.9);
      expect(results[1].content).toBe("mid");
      expect(results[2].content).toBe("low");
    });

    it("filters by userId", async () => {
      const { embedSingle, cosineSimilarity } = await import("@/lib/embeddings");
      vi.mocked(embedSingle).mockResolvedValue([0.1]);
      vi.mocked(cosineSimilarity).mockReturnValue(0.8);

      mockPrisma.voiceCorpusEntry.findMany.mockResolvedValue([]);

      const { querySimilarContent } = await import("@/lib/vector-store");
      await querySimilarContent("query", 5, USER_A.id);

      expect(mockPrisma.voiceCorpusEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_A.id, embedding: { not: null } },
        })
      );
    });

    it("caches entries per user", async () => {
      const { embedSingle, cosineSimilarity } = await import("@/lib/embeddings");
      vi.mocked(embedSingle).mockResolvedValue([0.1]);
      vi.mocked(cosineSimilarity).mockReturnValue(0.5);

      mockPrisma.voiceCorpusEntry.findMany.mockResolvedValue([]);

      const { querySimilarContent } = await import("@/lib/vector-store");
      await querySimilarContent("q1", 5, USER_A.id);
      await querySimilarContent("q2", 5, USER_A.id);

      // Should only query DB once due to cache
      expect(mockPrisma.voiceCorpusEntry.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("insertCorpusEntries", () => {
    it("embeds and inserts entries with userId", async () => {
      const { embed } = await import("@/lib/embeddings");
      vi.mocked(embed).mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
      mockPrisma.voiceCorpusEntry.create.mockResolvedValue({});

      const { insertCorpusEntries } = await import("@/lib/vector-store");
      const count = await insertCorpusEntries(
        [
          { source: "blog", content: "text 1" },
          { source: "blog", content: "text 2" },
        ],
        USER_A.id
      );

      expect(count).toBe(2);
      expect(mockPrisma.voiceCorpusEntry.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.voiceCorpusEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_A.id }),
        })
      );
    });
  });

  describe("getCorpusStats", () => {
    it("returns stats scoped to userId", async () => {
      mockPrisma.voiceCorpusEntry.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      mockPrisma.voiceCorpusEntry.findMany.mockResolvedValue([
        { source: "blog" },
        { source: "blog" },
        { source: "newsletter" },
      ]);
      mockPrisma.voiceCorpusEntry.findFirst.mockResolvedValue({
        createdAt: new Date("2026-03-01"),
      });

      const { getCorpusStats } = await import("@/lib/vector-store");
      const stats = await getCorpusStats(USER_A.id);

      expect(stats.total).toBe(10);
      expect(stats.withEmbeddings).toBe(8);
      expect(stats.sourceBreakdown).toEqual({ blog: 2, newsletter: 1 });
    });
  });
});
