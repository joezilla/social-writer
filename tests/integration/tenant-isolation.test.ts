import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { mockAsUser } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A, USER_B } from "../helpers/fixtures";

/**
 * Comprehensive tenant isolation tests.
 * Verifies that User A cannot access User B's resources across all API routes.
 */

vi.mock("@/lib/claude", () => ({
  generateText: vi.fn().mockResolvedValue("generated"),
  generateJSON: vi.fn().mockResolvedValue({ score: 50, flaggedPhrases: [], reasoning: "ok" }),
}));

vi.mock("@/lib/voice-rag", () => ({
  buildVoiceContext: vi.fn().mockResolvedValue("context"),
}));

vi.mock("@/lib/linkedin", () => ({
  getStoredToken: vi.fn().mockResolvedValue(null),
  publishPost: vi.fn(),
}));

vi.mock("@/lib/vector-store", () => ({
  getCorpusStats: vi.fn().mockResolvedValue({ total: 0, withEmbeddings: 0, sourceBreakdown: {}, lastUpdated: null }),
}));

vi.mock("@/lib/exa", () => ({
  searchMultipleQueries: vi.fn().mockResolvedValue([]),
}));

describe("Tenant Isolation", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
    // User A is authenticated
    mockAsUser(USER_A.id, USER_A.email);
  });

  describe("Posts", () => {
    it("GET /api/posts/[id] - cannot read User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);
      const { GET } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("GET", `/api/posts/${POST_B.id}`);
      const res = await GET(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("PATCH /api/posts/[id] - cannot update User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);
      const { PATCH } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("PATCH", `/api/posts/${POST_B.id}`, { title: "Hacked" });
      const res = await PATCH(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("DELETE /api/posts/[id] - cannot delete User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);
      const { DELETE } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("DELETE", `/api/posts/${POST_B.id}`);
      const res = await DELETE(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("GET /api/posts - only returns own posts", async () => {
      mockPrisma.post.findMany.mockResolvedValue([POST_A]);
      const { GET } = await import("@/app/api/posts/route");
      const res = await GET();
      const { body } = await parseResponse(res);
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_A.id } })
      );
    });
  });

  describe("Post Actions", () => {
    it("generate-draft - cannot generate for User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });
      const { POST } = await import("@/app/api/posts/[id]/generate-draft/route");
      const req = createRequest("POST", `/api/posts/${POST_B.id}/generate-draft`, {});
      const res = await POST(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("voice-score - cannot score User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);
      const { POST } = await import("@/app/api/posts/[id]/voice-score/route");
      const req = createRequest("POST", `/api/posts/${POST_B.id}/voice-score`);
      const res = await POST(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("fact-check - cannot fact-check User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });
      const { POST } = await import("@/app/api/posts/[id]/fact-check/route");
      const req = createRequest("POST", `/api/posts/${POST_B.id}/fact-check`);
      const res = await POST(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("publish - cannot publish User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);
      const { POST } = await import("@/app/api/posts/[id]/publish/route");
      const req = createRequest("POST", `/api/posts/${POST_B.id}/publish`);
      const res = await POST(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("research POST - cannot research User B's post", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });
      const { POST } = await import("@/app/api/posts/[id]/research/route");
      const req = createRequest("POST", `/api/posts/${POST_B.id}/research`, {});
      const res = await POST(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });

    it("research GET - cannot view User B's research", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });
      const { GET } = await import("@/app/api/posts/[id]/research/route");
      const req = createRequest("GET", `/api/posts/${POST_B.id}/research`);
      const res = await GET(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });
  });

  describe("Analytics", () => {
    it("impact - cannot view User B's post impact", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...POST_B,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });
      const { GET } = await import("@/app/api/analytics/posts/[id]/impact/route");
      const req = createRequest("GET", `/api/analytics/posts/${POST_B.id}/impact`);
      const res = await GET(req, { params: { id: POST_B.id } });
      expect(res.status).toBe(404);
    });
  });

  describe("Corpus", () => {
    it("stats - scoped to caller's userId", async () => {
      const { GET } = await import("@/app/api/corpus/stats/route");
      const res = await GET();
      expect(res.status).toBe(200);

      const { getCorpusStats } = await import("@/lib/vector-store");
      expect(getCorpusStats).toHaveBeenCalledWith(USER_A.id);
    });
  });

  describe("LinkedIn", () => {
    it("status - scoped to caller's userId", async () => {
      const { getStoredToken } = await import("@/lib/linkedin");
      vi.mocked(getStoredToken).mockResolvedValue(null);

      const { GET } = await import("@/app/api/linkedin/status/route");
      const res = await GET();
      expect(res.status).toBe(200);
      expect(getStoredToken).toHaveBeenCalledWith(USER_A.id);
    });
  });
});
