import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { USER_A } from "../helpers/fixtures";

vi.mock("@/lib/vector-store", () => ({
  insertCorpusEntries: vi.fn().mockResolvedValue(3),
  getCorpusStats: vi.fn().mockResolvedValue({
    total: 10,
    withEmbeddings: 8,
    sourceBreakdown: { blog: 7, newsletter: 3 },
    lastUpdated: "2026-03-01T00:00:00.000Z",
  }),
}));

describe("POST /api/corpus/ingest", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/corpus/ingest/route");
    const req = createRequest("POST", "/api/corpus/ingest", {
      source: "blog",
      content: "text",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when source is missing", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { POST } = await import("@/app/api/corpus/ingest/route");
    const req = createRequest("POST", "/api/corpus/ingest", {
      content: "text",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("ingests content with userId", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { POST } = await import("@/app/api/corpus/ingest/route");
    const req = createRequest("POST", "/api/corpus/ingest", {
      source: "blog",
      content: "Some voice corpus content that is long enough to test chunking.",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.inserted).toBe(3);

    const { insertCorpusEntries } = await import("@/lib/vector-store");
    expect(insertCorpusEntries).toHaveBeenCalledWith(
      expect.any(Array),
      USER_A.id
    );
  });
});

describe("GET /api/corpus/stats", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/corpus/stats/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns stats scoped to userId", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { GET } = await import("@/app/api/corpus/stats/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.total).toBe(10);

    const { getCorpusStats } = await import("@/lib/vector-store");
    expect(getCorpusStats).toHaveBeenCalledWith(USER_A.id);
  });
});
