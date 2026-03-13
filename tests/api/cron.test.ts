import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, USER_A } from "../helpers/fixtures";

vi.mock("@/lib/linkedin", () => ({
  getStoredToken: vi.fn(),
  publishPost: vi.fn().mockResolvedValue("linkedin-post-id"),
}));

describe("GET /api/cron/publish-scheduled", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const { GET } = await import("@/app/api/cron/publish-scheduled/route");
    const req = createRequest("GET", "/api/cron/publish-scheduled", undefined, {
      authorization: "Bearer wrong-secret",
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct CRON_SECRET", async () => {
    mockPrisma.scheduledPost.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/cron/publish-scheduled/route");
    const req = createRequest("GET", "/api/cron/publish-scheduled", undefined, {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.processed).toBe(0);
  });

  it("processes multiple scheduled posts independently", async () => {
    const { getStoredToken, publishPost } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken)
      .mockResolvedValueOnce({
        accessToken: "token",
        personUrn: "urn:li:person:123",
        displayName: "User",
        expiresAt: new Date(Date.now() + 86400000),
      })
      .mockResolvedValueOnce(null); // second post has no token

    mockPrisma.scheduledPost.findMany.mockResolvedValue([
      { id: "sched-1", postId: "post-1", userId: USER_A.id, scheduledAt: new Date(), user: USER_A },
      { id: "sched-2", postId: "post-2", userId: "user-no-token", scheduledAt: new Date(), user: { id: "user-no-token" } },
    ]);

    mockPrisma.post.findUnique
      .mockResolvedValueOnce({ ...POST_A, id: "post-1", body: "Content 1" })
      .mockResolvedValueOnce({ ...POST_A, id: "post-2", body: "Content 2" });

    mockPrisma.post.update.mockResolvedValue({});
    mockPrisma.scheduledPost.update.mockResolvedValue({});

    const { GET } = await import("@/app/api/cron/publish-scheduled/route");
    const req = createRequest("GET", "/api/cron/publish-scheduled", undefined, {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.processed).toBe(2);
    const results = body.results as Array<{ postId: string; success: boolean }>;
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  it("handles empty post body as failure", async () => {
    mockPrisma.scheduledPost.findMany.mockResolvedValue([
      { id: "sched-1", postId: "post-1", userId: USER_A.id, scheduledAt: new Date(), user: USER_A },
    ]);
    mockPrisma.post.findUnique.mockResolvedValue({ ...POST_A, id: "post-1", body: "" });
    mockPrisma.scheduledPost.update.mockResolvedValue({});

    const { GET } = await import("@/app/api/cron/publish-scheduled/route");
    const req = createRequest("GET", "/api/cron/publish-scheduled", undefined, {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    const results = body.results as Array<{ success: boolean; error: string }>;
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("empty");
  });
});
