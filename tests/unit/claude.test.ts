import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock("@/lib/settings", () => ({
  requireSetting: vi.fn().mockResolvedValue("test-anthropic-key"),
}));

describe("claude", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockReset();
    // Clear globalThis singleton
    const g = globalThis as Record<string, unknown>;
    delete g.anthropic;
    delete g.anthropicKey;
  });

  describe("generateText", () => {
    it("returns text from Claude response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Generated response" }],
      });

      const { generateText } = await import("@/lib/claude");
      const result = await generateText("system", "user prompt");
      expect(result).toBe("Generated response");
    });

    it("passes correct model and params", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "ok" }],
      });

      const { generateText } = await import("@/lib/claude");
      await generateText("sys prompt", "user prompt", 2048);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: "sys prompt",
        messages: [{ role: "user", content: "user prompt" }],
      });
    });
  });

  describe("generateJSON", () => {
    it("parses JSON from response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: '{"score": 85}' }],
      });

      const { generateJSON } = await import("@/lib/claude");
      const result = await generateJSON("sys", "prompt");
      expect(result).toEqual({ score: 85 });
    });

    it("strips markdown code fences", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: '```json\n{"key": "value"}\n```' }],
      });

      const { generateJSON } = await import("@/lib/claude");
      const result = await generateJSON("sys", "prompt");
      expect(result).toEqual({ key: "value" });
    });

    it("strips plain code fences", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: '```\n[1, 2, 3]\n```' }],
      });

      const { generateJSON } = await import("@/lib/claude");
      const result = await generateJSON("sys", "prompt");
      expect(result).toEqual([1, 2, 3]);
    });
  });
});
