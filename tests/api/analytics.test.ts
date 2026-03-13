import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A } from "../helpers/fixtures";

vi.mock("@/lib/claude", () => ({
  generateText: vi.fn().mockResolvedValue("Monthly digest content here."),
}));

describe("GET /api/analytics/overview", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/analytics/overview/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns analytics scoped to userId", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.followerSnapshot.findFirst.mockResolvedValue({
      followerCount: 500,
    });
    mockPrisma.followerSnapshot.count.mockResolvedValue(10);
    mockPrisma.post.count.mockResolvedValue(3);
    mockPrisma.postAnalytics.aggregate.mockResolvedValue({
      _sum: { impressions: 5000 },
    });
    mockPrisma.followerSnapshot.findMany.mockResolvedValue([]);
    mockPrisma.post.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/analytics/overview/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.currentFollowers).toBe(500);
    expect(body.publishedCount).toBe(3);
    expect(body.totalImpressions).toBe(5000);
  });
});

describe("GET /api/analytics/monthly-digest", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/analytics/monthly-digest/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns digest for user's data", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findMany.mockResolvedValue([
      {
        ...POST_A,
        status: "PUBLISHED",
        publishedAt: new Date(),
        analytics: [{ impressions: 100, reactions: 5, comments: 2, shares: 1 }],
      },
    ]);
    mockPrisma.followerSnapshot.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/analytics/monthly-digest/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.digest).toBe("Monthly digest content here.");
  });
});

describe("GET /api/analytics/posts/[id]/impact", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
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

  it("returns impact data for own published post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const publishedAt = new Date("2026-02-15");
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      status: "PUBLISHED",
      publishedAt,
    });
    mockPrisma.postAnalytics.findFirst.mockResolvedValue({
      impressions: 200,
      reactions: 10,
      comments: 3,
      shares: 2,
    });
    mockPrisma.followerSnapshot.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/analytics/posts/[id]/impact/route");
    const req = createRequest("GET", `/api/analytics/posts/${POST_A.id}/impact`);
    const res = await GET(req, { params: { id: POST_A.id } });
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.impressions).toBe(200);
  });
});
