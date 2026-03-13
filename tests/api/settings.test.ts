import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockAsAdmin, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { USER_A } from "../helpers/fixtures";

vi.mock("@/lib/settings", () => ({
  getAllSettings: vi.fn().mockResolvedValue([]),
  getUserSettings: vi.fn().mockResolvedValue([
    { key: "LINKEDIN_PROFILE_HANDLE", value: "my-handle", description: "LINKEDIN_PROFILE_HANDLE" },
  ]),
  SETTING_DEFINITIONS: {
    ANTHROPIC_API_KEY: { sensitive: true, group: "api_keys", description: "Anthropic API key" },
  },
  USER_SETTING_KEYS: ["LINKEDIN_PROFILE_HANDLE", "SCRAPER_CRON"],
  setSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  setUserSetting: vi.fn().mockResolvedValue(undefined),
  deleteUserSetting: vi.fn().mockResolvedValue(undefined),
  requireSetting: vi.fn().mockResolvedValue("test-key"),
  requireAdmin: vi.fn(),
}));

describe("GET /api/settings", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/settings/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user settings for regular user", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { GET } = await import("@/app/api/settings/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.userSettings).toBeDefined();
  });
});

describe("PUT /api/settings/[key]", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("allows user to set per-user setting", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { PUT } = await import("@/app/api/settings/[key]/route");
    const req = createRequest("PUT", "/api/settings/LINKEDIN_PROFILE_HANDLE", {
      value: "my-handle",
    });
    const res = await PUT(req, { params: { key: "LINKEDIN_PROFILE_HANDLE" } });
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });

  it("returns 403 when non-admin tries to set global setting", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { PUT } = await import("@/app/api/settings/[key]/route");
    const req = createRequest("PUT", "/api/settings/ANTHROPIC_API_KEY", {
      value: "sk-test",
    });
    const res = await PUT(req, { params: { key: "ANTHROPIC_API_KEY" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 for empty value", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { PUT } = await import("@/app/api/settings/[key]/route");
    const req = createRequest("PUT", "/api/settings/LINKEDIN_PROFILE_HANDLE", {
      value: "",
    });
    const res = await PUT(req, { params: { key: "LINKEDIN_PROFILE_HANDLE" } });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/settings/[key]", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("allows user to delete per-user setting", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { DELETE } = await import("@/app/api/settings/[key]/route");
    const req = createRequest("DELETE", "/api/settings/LINKEDIN_PROFILE_HANDLE");
    const res = await DELETE(req, { params: { key: "LINKEDIN_PROFILE_HANDLE" } });
    expect(res.status).toBe(200);
  });

  it("returns 403 when non-admin tries to delete global setting", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { DELETE } = await import("@/app/api/settings/[key]/route");
    const req = createRequest("DELETE", "/api/settings/ANTHROPIC_API_KEY");
    const res = await DELETE(req, { params: { key: "ANTHROPIC_API_KEY" } });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/settings/test", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/settings/test/route");
    const req = createRequest("POST", "/api/settings/test", { key: "ANTHROPIC_API_KEY" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { POST } = await import("@/app/api/settings/test/route");
    const req = createRequest("POST", "/api/settings/test", { key: "ANTHROPIC_API_KEY" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
