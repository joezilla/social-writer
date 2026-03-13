import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";

vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn().mockReturnValue({
    ciphertext: "enc-token",
    iv: "enc-iv",
    tag: "enc-tag",
  }),
  decrypt: vi.fn().mockReturnValue("decrypted-access-token"),
}));

vi.mock("@/lib/settings", () => ({
  requireSetting: vi.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      LINKEDIN_CLIENT_ID: "test-client-id",
      LINKEDIN_CLIENT_SECRET: "test-client-secret",
      LINKEDIN_REDIRECT_URI: "http://localhost:3000/api/linkedin/callback",
    };
    return Promise.resolve(map[key] ?? "test-value");
  }),
}));

describe("linkedin", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  describe("getAuthorizationUrl", () => {
    it("builds correct OAuth URL with params", async () => {
      const { getAuthorizationUrl } = await import("@/lib/linkedin");
      const url = await getAuthorizationUrl("test-state");

      expect(url).toContain("linkedin.com/oauth/v2/authorization");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("state=test-state");
      expect(url).toContain("scope=openid+profile+w_member_social");
      expect(url).toContain("response_type=code");
    });
  });

  describe("getStoredToken", () => {
    it("returns null when no token exists", async () => {
      mockPrisma.linkedInToken.findUnique.mockResolvedValue(null);

      const { getStoredToken } = await import("@/lib/linkedin");
      const result = await getStoredToken("user-1");
      expect(result).toBeNull();
    });

    it("decrypts and returns stored token", async () => {
      mockPrisma.linkedInToken.findUnique.mockResolvedValue({
        accessToken: "encrypted",
        tokenIv: "iv",
        tokenTag: "tag",
        personUrn: "urn:li:person:123",
        displayName: "Test User",
        expiresAt: new Date("2026-12-31"),
      });

      const { getStoredToken } = await import("@/lib/linkedin");
      const result = await getStoredToken("user-1");

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("decrypted-access-token");
      expect(result!.personUrn).toBe("urn:li:person:123");
    });
  });

  describe("publishPost", () => {
    it("sends correct headers and body to LinkedIn API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "x-restli-id": "linkedin-post-123" }),
      }) as unknown as typeof fetch;

      const { publishPost } = await import("@/lib/linkedin");
      const postId = await publishPost("token", "urn:li:person:123", "Post text");

      expect(postId).toBe("linkedin-post-123");
      expect(fetch).toHaveBeenCalledWith(
        "https://api.linkedin.com/rest/posts",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token",
            "LinkedIn-Version": "202402",
          }),
        })
      );

      const body = JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
      );
      expect(body.author).toBe("urn:li:person:123");
      expect(body.commentary).toBe("Post text");
      expect(body.visibility).toBe("PUBLIC");
    });

    it("throws on LinkedIn API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("LinkedIn error"),
      }) as unknown as typeof fetch;

      const { publishPost } = await import("@/lib/linkedin");
      await expect(
        publishPost("token", "urn:li:person:123", "text")
      ).rejects.toThrow("LinkedIn publish failed");
    });
  });

  describe("exchangeCodeForToken", () => {
    it("exchanges code and stores encrypted token", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "real-token", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ sub: "person-sub", name: "Test User" }),
        }) as unknown as typeof fetch;

      mockPrisma.linkedInToken.upsert.mockResolvedValue({});

      const { exchangeCodeForToken } = await import("@/lib/linkedin");
      const result = await exchangeCodeForToken("auth-code", "user-1");

      expect(result.personUrn).toBe("urn:li:person:person-sub");
      expect(result.displayName).toBe("Test User");
      expect(mockPrisma.linkedInToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          create: expect.objectContaining({
            accessToken: "enc-token",
            tokenIv: "enc-iv",
            tokenTag: "enc-tag",
          }),
        })
      );
    });
  });
});
