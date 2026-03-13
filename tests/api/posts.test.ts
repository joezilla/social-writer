import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, USER_A } from "../helpers/fixtures";

describe("POST /api/posts", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/posts/route");
    const req = createRequest("POST", "/api/posts", { title: "Test" });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("creates post with caller's userId", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.create.mockResolvedValue({ ...POST_A, title: "New Post" });

    const { POST } = await import("@/app/api/posts/route");
    const req = createRequest("POST", "/api/posts", { title: "New Post", topicTags: "ai" });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(201);
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "New Post",
        topicTags: "ai",
        userId: USER_A.id,
      }),
    });
  });

  it("returns 400 when title is missing", async () => {
    mockAsUser();
    const { POST } = await import("@/app/api/posts/route");
    const req = createRequest("POST", "/api/posts", {});
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("Title is required");
  });
});

describe("GET /api/posts", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/posts/route");
    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns only caller's posts", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findMany.mockResolvedValue([POST_A]);

    const { GET } = await import("@/app/api/posts/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_A.id },
      })
    );
  });
});
