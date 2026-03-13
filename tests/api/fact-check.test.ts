import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A, RESEARCH_BRIEF } from "../helpers/fixtures";

vi.mock("@/lib/claude", () => ({
  generateJSON: vi.fn().mockResolvedValue([
    {
      text: "AI adoption grew 30%",
      verdict: "supported",
      source: "McKinsey",
      sourceUrl: "https://example.com",
      suggestion: null,
    },
  ]),
}));

describe("POST /api/posts/[id]/fact-check", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;
  const params = { params: { id: POST_A.id } };

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/posts/[id]/fact-check/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/fact-check`);
    const res = await POST(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });

    const { POST } = await import("@/app/api/posts/[id]/fact-check/route");
    const req = createRequest("POST", `/api/posts/${POST_B.id}/fact-check`);
    const res = await POST(req, { params: { id: POST_B.id } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when post body is empty", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      body: "",
      researchBrief: null,
    });

    const { POST } = await import("@/app/api/posts/[id]/fact-check/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/fact-check`);
    const res = await POST(req, params);
    expect(res.status).toBe(400);
  });

  it("returns fact-check claims", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      researchBrief: RESEARCH_BRIEF,
    });

    const { POST } = await import("@/app/api/posts/[id]/fact-check/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/fact-check`);
    const res = await POST(req, params);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect((body.claims as unknown[]).length).toBe(1);
  });
});
