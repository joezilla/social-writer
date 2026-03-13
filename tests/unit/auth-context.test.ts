import { describe, it, expect, beforeEach } from "vitest";
import { mockAsUser, mockAsAdmin, mockUnauthed } from "../helpers/mock-auth";

describe("auth-context", () => {
  beforeEach(() => {
    // Reset auth mock state
  });

  describe("requireAuth", () => {
    it("returns userId, role, email for authenticated user", async () => {
      mockAsUser("user-123", "test@example.com");
      const { requireAuth } = await import("@/lib/auth-context");
      const result = await requireAuth();
      expect(result).toEqual({
        userId: "user-123",
        role: "user",
        email: "test@example.com",
      });
    });

    it("throws 401 for unauthenticated request", async () => {
      mockUnauthed();
      const { requireAuth, AuthError } = await import("@/lib/auth-context");
      try {
        await requireAuth();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as InstanceType<typeof AuthError>).status).toBe(401);
      }
    });

    it("returns admin role when session has admin", async () => {
      mockAsAdmin("admin-1", "admin@example.com");
      const { requireAuth } = await import("@/lib/auth-context");
      const result = await requireAuth();
      expect(result.role).toBe("admin");
    });
  });

  describe("requireAdmin", () => {
    it("returns result for admin user", async () => {
      mockAsAdmin("admin-1", "admin@example.com");
      const { requireAdmin } = await import("@/lib/auth-context");
      const result = await requireAdmin();
      expect(result.role).toBe("admin");
      expect(result.userId).toBe("admin-1");
    });

    it("throws 403 for non-admin user", async () => {
      mockAsUser("user-1", "user@example.com");
      const { requireAdmin, AuthError } = await import("@/lib/auth-context");
      try {
        await requireAdmin();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as InstanceType<typeof AuthError>).status).toBe(403);
      }
    });

    it("throws 401 for unauthenticated request", async () => {
      mockUnauthed();
      const { requireAdmin, AuthError } = await import("@/lib/auth-context");
      try {
        await requireAdmin();
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as InstanceType<typeof AuthError>).status).toBe(401);
      }
    });
  });
});
