import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockReturnValue({
    ciphertext: "encrypted-value",
    iv: "test-iv",
    tag: "test-tag",
  }),
  decrypt: vi.fn().mockReturnValue("decrypted-value"),
}));

describe("settings", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
    // Clear globalThis cache
    const g = globalThis as Record<string, unknown>;
    delete g.settingsCache;
  });

  describe("getSetting", () => {
    it("returns value from DB (unencrypted)", async () => {
      mockPrisma.appSetting.findUnique.mockResolvedValue({
        key: "LINKEDIN_CLIENT_ID",
        value: "my-client-id",
        encrypted: false,
        iv: null,
        tag: null,
      });

      const { getSetting } = await import("@/lib/settings");
      const val = await getSetting("LINKEDIN_CLIENT_ID");
      expect(val).toBe("my-client-id");
    });

    it("decrypts encrypted DB value", async () => {
      mockPrisma.appSetting.findUnique.mockResolvedValue({
        key: "ANTHROPIC_API_KEY",
        value: "encrypted-value",
        encrypted: true,
        iv: "test-iv",
        tag: "test-tag",
      });

      const { getSetting } = await import("@/lib/settings");
      const val = await getSetting("ANTHROPIC_API_KEY");
      expect(val).toBe("decrypted-value");
    });

    it("falls back to env var when not in DB", async () => {
      mockPrisma.appSetting.findUnique.mockResolvedValue(null);
      process.env.TEST_SETTING_XYZ = "from-env";

      const { getSetting } = await import("@/lib/settings");
      const val = await getSetting("TEST_SETTING_XYZ");
      expect(val).toBe("from-env");

      delete process.env.TEST_SETTING_XYZ;
    });

    it("returns undefined when not found anywhere", async () => {
      mockPrisma.appSetting.findUnique.mockResolvedValue(null);
      const { getSetting } = await import("@/lib/settings");
      const val = await getSetting("NONEXISTENT_KEY_12345");
      expect(val).toBeUndefined();
    });

    it("uses cache on second call", async () => {
      mockPrisma.appSetting.findUnique.mockResolvedValue({
        key: "LINKEDIN_CLIENT_ID",
        value: "cached-value",
        encrypted: false,
        iv: null,
        tag: null,
      });

      const { getSetting } = await import("@/lib/settings");
      await getSetting("LINKEDIN_CLIENT_ID");
      await getSetting("LINKEDIN_CLIENT_ID");

      expect(mockPrisma.appSetting.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe("requireSetting", () => {
    it("throws when setting is not configured", async () => {
      mockPrisma.appSetting.findUnique.mockResolvedValue(null);
      const { requireSetting } = await import("@/lib/settings");
      await expect(requireSetting("MISSING_KEY_123")).rejects.toThrow(
        "Required setting MISSING_KEY_123 is not configured"
      );
    });
  });

  describe("setSetting", () => {
    it("encrypts sensitive settings", async () => {
      mockPrisma.appSetting.upsert.mockResolvedValue({});

      const { setSetting } = await import("@/lib/settings");
      await setSetting("ANTHROPIC_API_KEY", "sk-test");

      expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ encrypted: true }),
        })
      );
    });

    it("stores non-sensitive settings as plaintext", async () => {
      mockPrisma.appSetting.upsert.mockResolvedValue({});

      const { setSetting } = await import("@/lib/settings");
      await setSetting("LINKEDIN_CLIENT_ID", "client-123");

      expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            encrypted: false,
            value: "client-123",
          }),
        })
      );
    });
  });

  describe("getEffectiveSetting", () => {
    it("returns user setting when available", async () => {
      mockPrisma.userSetting.findUnique.mockResolvedValue({
        userId: "user-1",
        key: "LINKEDIN_PROFILE_HANDLE",
        value: "user-handle",
        encrypted: false,
        iv: null,
        tag: null,
      });

      const { getEffectiveSetting } = await import("@/lib/settings");
      const val = await getEffectiveSetting("user-1", "LINKEDIN_PROFILE_HANDLE");
      expect(val).toBe("user-handle");
    });

    it("falls back to app setting when user setting missing", async () => {
      mockPrisma.userSetting.findUnique.mockResolvedValue(null);
      mockPrisma.appSetting.findUnique.mockResolvedValue({
        key: "SOME_KEY",
        value: "app-value",
        encrypted: false,
        iv: null,
        tag: null,
      });

      const { getEffectiveSetting } = await import("@/lib/settings");
      const val = await getEffectiveSetting("user-1", "SOME_KEY");
      expect(val).toBe("app-value");
    });
  });
});
