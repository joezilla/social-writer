import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A } from "../helpers/fixtures";

vi.mock("@/lib/claude", () => ({
  generateJSON: vi.fn()
    .mockResolvedValueOnce(["query1", "query2", "query3", "query4"])
    .mockResolvedValueOnce({
      summary: "Research summary",
      keyClaims: [{ claim: "Key finding", source: "Source", url: "https://example.com" }],
      counterarguments: ["Counter 1"],
      recommendedAngle: "Suggested angle",
    }),
}));

vi.mock("@/lib/exa", () => ({
  searchMultipleQueries: vi.fn().mockResolvedValue([
    { title: "Result", url: "https://example.com", excerpt: "Excerpt", publishedDate: null },
  ]),
}));

describe("POST /api/posts/[id]/research", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;
  const params = { params: { id: POST_A.id } };

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/posts/[id]/research/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/research`);
    const res = await POST(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });

    const { POST } = await import("@/app/api/posts/[id]/research/route");
    const req = createRequest("POST", `/api/posts/${POST_B.id}/research`);
    const res = await POST(req, { params: { id: POST_B.id } });
    expect(res.status).toBe(404);
  });

  it("creates research brief with userId", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_A, researchBrief: null });
    mockPrisma.researchBrief.create.mockResolvedValue({ id: "brief-new" });
    mockPrisma.post.update.mockResolvedValue(POST_A);

    const { POST } = await import("@/app/api/posts/[id]/research/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/research`, {});
    const res = await POST(req, params);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockPrisma.researchBrief.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_A.id }),
    });
  });
});

describe("GET /api/posts/[id]/research", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_B, researchBrief: null });

    const { GET } = await import("@/app/api/posts/[id]/research/route");
    const req = createRequest("GET", `/api/posts/${POST_B.id}/research`);
    const res = await GET(req, { params: { id: POST_B.id } });
    expect(res.status).toBe(404);
  });
});
