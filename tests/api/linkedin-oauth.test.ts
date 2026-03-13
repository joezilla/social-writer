import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { parseResponse } from "../helpers/mock-request";
import { USER_A } from "../helpers/fixtures";

vi.mock("@/lib/linkedin", () => ({
  getAuthorizationUrl: vi.fn().mockResolvedValue("https://linkedin.com/oauth?test=1"),
  getStoredToken: vi.fn(),
}));

// Mock next/headers cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe("POST /api/linkedin/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/linkedin/auth/route");
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns authorization URL", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { POST } = await import("@/app/api/linkedin/auth/route");
    const res = await POST();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.url).toContain("linkedin.com/oauth");
  });
});

describe("GET /api/linkedin/status", () => {
  beforeEach(() => {
    vi.resetModules();
    useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/linkedin/status/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns connected: false when no token", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { getStoredToken } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken).mockResolvedValue(null);

    const { GET } = await import("@/app/api/linkedin/status/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.connected).toBe(false);
  });

  it("returns connected: true with valid token", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { getStoredToken } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken).mockResolvedValue({
      accessToken: "token",
      personUrn: "urn:li:person:123",
      displayName: "Test User",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const { GET } = await import("@/app/api/linkedin/status/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.displayName).toBe("Test User");
  });

  it("returns expired: true when token expired", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    const { getStoredToken } = await import("@/lib/linkedin");
    vi.mocked(getStoredToken).mockResolvedValue({
      accessToken: "token",
      personUrn: "urn:li:person:123",
      displayName: "Test User",
      expiresAt: new Date("2020-01-01"),
    });

    const { GET } = await import("@/app/api/linkedin/status/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.expired).toBe(true);
  });
});
