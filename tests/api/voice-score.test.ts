import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A } from "../helpers/fixtures";

vi.mock("@/lib/claude", () => ({
  generateJSON: vi.fn().mockResolvedValue({
    score: 82,
    flaggedPhrases: ["in today's landscape"],
    reasoning: "Good voice match overall",
  }),
}));

describe("POST /api/posts/[id]/voice-score", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;
  const params = { params: { id: POST_A.id } };

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/posts/[id]/voice-score/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/voice-score`);
    const res = await POST(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue(POST_B);

    const { POST } = await import("@/app/api/posts/[id]/voice-score/route");
    const req = createRequest("POST", `/api/posts/${POST_B.id}/voice-score`);
    const res = await POST(req, { params: { id: POST_B.id } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when post body is empty", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_A, body: "" });

    const { POST } = await import("@/app/api/posts/[id]/voice-score/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/voice-score`);
    const res = await POST(req, params);
    expect(res.status).toBe(400);
  });

  it("returns voice score and persists it", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue(POST_A);
    mockPrisma.post.update.mockResolvedValue({ ...POST_A, voiceScore: 82 });

    const { POST } = await import("@/app/api/posts/[id]/voice-score/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/voice-score`);
    const res = await POST(req, params);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.score).toBe(82);
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { voiceScore: 82 },
      })
    );
  });
});
