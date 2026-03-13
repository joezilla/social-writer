import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A } from "../helpers/fixtures";

vi.mock("@/lib/linkedin", () => ({
  getStoredToken: vi.fn(),
  publishPost: vi.fn().mockResolvedValue("linkedin-post-id-123"),
}));

describe("POST /api/posts/[id]/publish", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;
  const params = { params: { id: POST_A.id } };

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/publish`);
    const res = await POST(req, params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue(POST_B);

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const req = createRequest("POST", `/api/posts/${POST_B.id}/publish`);
    const res = await POST(req, { params: { id: POST_B.id } });
    expect(res.status).toBe(404);
  });

  it("returns 400 when post body is empty", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_A, body: "" });

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/publish`);
    const res = await POST(req, params);
    expect(res.status).toBe(400);
  });

  it("returns 401 when LinkedIn not connected", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue(POST_A);

    const { getStoredToken } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken).mockResolvedValue(null);

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/publish`);
    const res = await POST(req, params);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.error).toBe("LinkedIn not connected");
  });

  it("returns 401 when LinkedIn token expired", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue(POST_A);

    const { getStoredToken } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken).mockResolvedValue({
      accessToken: "token",
      personUrn: "urn:li:person:123",
      displayName: "User",
      expiresAt: new Date("2020-01-01"), // expired
    });

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/publish`);
    const res = await POST(req, params);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.error).toBe("LinkedIn token expired");
  });

  it("publishes and updates post status to PUBLISHED", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue(POST_A);
    mockPrisma.post.update.mockResolvedValue({
      ...POST_A,
      status: "PUBLISHED",
      linkedinPostId: "linkedin-post-id-123",
    });

    const { getStoredToken } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken).mockResolvedValue({
      accessToken: "valid-token",
      personUrn: "urn:li:person:123",
      displayName: "User",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const { POST } = await import("@/app/api/posts/[id]/publish/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/publish`);
    const res = await POST(req, params);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      })
    );
  });
});
