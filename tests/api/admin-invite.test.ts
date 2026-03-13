import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockAsAdmin, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";

describe("POST /api/admin/invite", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/admin/invite/route");
    const req = createRequest("POST", "/api/admin/invite", {
      email: "new@test.com",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { POST } = await import("@/app/api/admin/invite/route");
    const req = createRequest("POST", "/api/admin/invite", {
      email: "new@test.com",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates invite with 48h expiry", async () => {
    mockAsAdmin();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-id",
      email: "new@test.com",
      role: "user",
    });

    const { POST } = await import("@/app/api/admin/invite/route");
    const req = createRequest("POST", "/api/admin/invite", {
      email: "new@test.com",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.inviteUrl).toContain("/invite?token=");
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "new@test.com",
          inviteToken: expect.any(String),
          inviteExpires: expect.any(Date),
        }),
      })
    );
  });

  it("returns 409 for existing email", async () => {
    mockAsAdmin();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const { POST } = await import("@/app/api/admin/invite/route");
    const req = createRequest("POST", "/api/admin/invite", {
      email: "existing@test.com",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when email missing", async () => {
    mockAsAdmin();
    const { POST } = await import("@/app/api/admin/invite/route");
    const req = createRequest("POST", "/api/admin/invite", {});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
