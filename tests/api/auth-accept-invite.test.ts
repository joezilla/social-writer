import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { createRequest, parseResponse } from "../helpers/mock-request";

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
}));

describe("POST /api/auth/accept-invite", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 400 when token or password missing", async () => {
    const { POST } = await import("@/app/api/auth/accept-invite/route");
    const req = createRequest("POST", "/api/auth/accept-invite", { token: "abc" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for password shorter than 8 characters", async () => {
    const { POST } = await import("@/app/api/auth/accept-invite/route");
    const req = createRequest("POST", "/api/auth/accept-invite", {
      token: "valid-token",
      password: "short",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("8 characters");
  });

  it("returns 400 for invalid token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/auth/accept-invite/route");
    const req = createRequest("POST", "/api/auth/accept-invite", {
      token: "invalid-token",
      password: "password123",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("Invalid invite token");
  });

  it("returns 400 for expired token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      inviteExpires: new Date("2020-01-01"),
    });

    const { POST } = await import("@/app/api/auth/accept-invite/route");
    const req = createRequest("POST", "/api/auth/accept-invite", {
      token: "expired-token",
      password: "password123",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("expired");
  });

  it("sets password and clears invite token on success", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      inviteExpires: new Date(Date.now() + 86400000),
    });
    mockPrisma.user.update.mockResolvedValue({});

    const { POST } = await import("@/app/api/auth/accept-invite/route");
    const req = createRequest("POST", "/api/auth/accept-invite", {
      token: "valid-token",
      password: "password123",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "$2a$12$hashed",
        inviteToken: null,
        inviteExpires: null,
      },
    });
  });
});
