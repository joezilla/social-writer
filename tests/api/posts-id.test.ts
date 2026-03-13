import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, POST_B, USER_A } from "../helpers/fixtures";

describe("/api/posts/[id]", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;
  const params = { params: { id: POST_A.id } };
  const otherParams = { params: { id: POST_B.id } };

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      mockUnauthed();
      const { GET } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("GET", `/api/posts/${POST_A.id}`);
      const res = await GET(req, params);
      const { status } = await parseResponse(res);
      expect(status).toBe(401);
    });

    it("returns own post with versions", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue({ ...POST_A, versions: [] });

      const { GET } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("GET", `/api/posts/${POST_A.id}`);
      const res = await GET(req, params);
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.id).toBe(POST_A.id);
    });

    it("returns 404 for another user's post (tenant isolation)", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_B); // owned by USER_B

      const { GET } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("GET", `/api/posts/${POST_B.id}`);
      const res = await GET(req, otherParams);
      const { status, body } = await parseResponse(res);

      expect(status).toBe(404);
      expect(body.error).toBe("Post not found");
    });
  });

  describe("PATCH", () => {
    it("updates own post", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_A);
      mockPrisma.post.update.mockResolvedValue({ ...POST_A, title: "Updated" });

      const { PATCH } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("PATCH", `/api/posts/${POST_A.id}`, {
        title: "Updated",
      });
      const res = await PATCH(req, params);
      const { status } = await parseResponse(res);
      expect(status).toBe(200);
    });

    it("returns 404 for another user's post (tenant isolation)", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);

      const { PATCH } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("PATCH", `/api/posts/${POST_B.id}`, {
        title: "Hacked",
      });
      const res = await PATCH(req, otherParams);
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });

    it("creates PostVersion when body changes", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_A);
      mockPrisma.postVersion.create.mockResolvedValue({});
      mockPrisma.post.update.mockResolvedValue({ ...POST_A, body: "New body" });

      const { PATCH } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("PATCH", `/api/posts/${POST_A.id}`, {
        body: "New body",
      });
      const res = await PATCH(req, params);
      const { status } = await parseResponse(res);

      expect(status).toBe(200);
      expect(mockPrisma.postVersion.create).toHaveBeenCalledWith({
        data: {
          postId: POST_A.id,
          body: POST_A.body,
          note: "Auto-save",
        },
      });
    });

    it("does NOT create PostVersion when only title changes", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_A);
      mockPrisma.post.update.mockResolvedValue({ ...POST_A, title: "New title" });

      const { PATCH } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("PATCH", `/api/posts/${POST_A.id}`, {
        title: "New title",
      });
      const res = await PATCH(req, params);

      expect(mockPrisma.postVersion.create).not.toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("deletes own post", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_A);
      mockPrisma.post.delete.mockResolvedValue(POST_A);

      const { DELETE } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("DELETE", `/api/posts/${POST_A.id}`);
      const res = await DELETE(req, params);
      const { status, body } = await parseResponse(res);

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("returns 404 for another user's post (tenant isolation)", async () => {
      mockAsUser(USER_A.id, USER_A.email);
      mockPrisma.post.findUnique.mockResolvedValue(POST_B);

      const { DELETE } = await import("@/app/api/posts/[id]/route");
      const req = createRequest("DELETE", `/api/posts/${POST_B.id}`);
      const res = await DELETE(req, otherParams);
      const { status } = await parseResponse(res);
      expect(status).toBe(404);
    });
  });
});
