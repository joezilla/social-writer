import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma, type MockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockAsAdmin, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { ADMIN, USER_A } from "../helpers/fixtures";

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
}));

describe("GET /api/admin/users", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns user list for admin", async () => {
    mockAsAdmin();
    mockPrisma.user.findMany.mockResolvedValue([
      { ...ADMIN, _count: { posts: 0, voiceCorpusEntries: 0 } },
      { ...USER_A, _count: { posts: 5, voiceCorpusEntries: 10 } },
    ]);

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect((body.users as unknown[]).length).toBe(2);
  });
});

describe("POST /api/admin/users", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { POST } = await import("@/app/api/admin/users/route");
    const req = createRequest("POST", "/api/admin/users", {
      email: "new@test.com",
      password: "password123",
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates user for admin", async () => {
    mockAsAdmin();
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user",
      email: "new@test.com",
      name: null,
      role: "user",
      createdAt: new Date(),
    });

    const { POST } = await import("@/app/api/admin/users/route");
    const req = createRequest("POST", "/api/admin/users", {
      email: "new@test.com",
      password: "password123",
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(201);
  });

  it("returns 409 for duplicate email", async () => {
    mockAsAdmin();
    mockPrisma.user.findUnique.mockResolvedValue(USER_A);

    const { POST } = await import("@/app/api/admin/users/route");
    const req = createRequest("POST", "/api/admin/users", {
      email: USER_A.email,
      password: "password123",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 when email or password missing", async () => {
    mockAsAdmin();
    const { POST } = await import("@/app/api/admin/users/route");
    const req = createRequest("POST", "/api/admin/users", { email: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 403 for non-admin", async () => {
    mockAsUser();
    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    const req = createRequest("PATCH", `/api/admin/users/${USER_A.id}`, {
      enabled: false,
    });
    const res = await PATCH(req, { params: { id: USER_A.id } });
    expect(res.status).toBe(403);
  });

  it("toggles user enabled status", async () => {
    mockAsAdmin();
    mockPrisma.user.update.mockResolvedValue({ ...USER_A, enabled: false });

    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    const req = createRequest("PATCH", `/api/admin/users/${USER_A.id}`, {
      enabled: false,
    });
    const res = await PATCH(req, { params: { id: USER_A.id } });
    const { status } = await parseResponse(res);
    expect(status).toBe(200);
  });

  it("toggles user role", async () => {
    mockAsAdmin();
    mockPrisma.user.update.mockResolvedValue({ ...USER_A, role: "admin" });

    const { PATCH } = await import("@/app/api/admin/users/[id]/route");
    const req = createRequest("PATCH", `/api/admin/users/${USER_A.id}`, {
      role: "admin",
    });
    const res = await PATCH(req, { params: { id: USER_A.id } });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  let mockPrisma: MockPrisma;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 400 when trying to delete self", async () => {
    mockAsAdmin(ADMIN.id, ADMIN.email);
    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const req = createRequest("DELETE", `/api/admin/users/${ADMIN.id}`);
    const res = await DELETE(req, { params: { id: ADMIN.id } });
    expect(res.status).toBe(400);
  });

  it("deletes other user", async () => {
    mockAsAdmin(ADMIN.id, ADMIN.email);
    mockPrisma.user.delete.mockResolvedValue(USER_A);

    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const req = createRequest("DELETE", `/api/admin/users/${USER_A.id}`);
    const res = await DELETE(req, { params: { id: USER_A.id } });
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
