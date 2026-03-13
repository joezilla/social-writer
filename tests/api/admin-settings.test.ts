import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockAsAdmin, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";

vi.mock("@/lib/settings", () => ({
  getAllSettings: vi.fn().mockResolvedValue([
    { key: "ANTHROPIC_API_KEY", hasValue: true, source: "db", group: "api_keys", sensitive: true },
  ]),
  setSetting: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/admin/settings", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/admin/settings/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { GET } = await import("@/app/api/admin/settings/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns settings for admin", async () => {
    mockAsAdmin();
    const { GET } = await import("@/app/api/admin/settings/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.settings).toBeDefined();
  });
});

describe("PUT /api/admin/settings", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { PUT } = await import("@/app/api/admin/settings/route");
    const req = createRequest("PUT", "/api/admin/settings", {
      key: "ANTHROPIC_API_KEY",
      value: "sk-test",
    });
    const res = await PUT(req);
    expect(res.status).toBe(403);
  });

  it("saves setting for admin", async () => {
    mockAsAdmin();
    const { PUT } = await import("@/app/api/admin/settings/route");
    const req = createRequest("PUT", "/api/admin/settings", {
      key: "ANTHROPIC_API_KEY",
      value: "sk-test",
    });
    const res = await PUT(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });
});
