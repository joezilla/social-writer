import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/vector-store", () => ({
  querySimilarContent: vi.fn(),
}));

describe("voice-rag", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns joined content when matches found", async () => {
    const { querySimilarContent } = await import("@/lib/vector-store");
    vi.mocked(querySimilarContent).mockResolvedValue([
      { id: "1", content: "First piece", source: "blog", title: null, similarity: 0.9 },
      { id: "2", content: "Second piece", source: "blog", title: null, similarity: 0.8 },
    ]);

    const { buildVoiceContext } = await import("@/lib/voice-rag");
    const result = await buildVoiceContext("test topic", "user-1");

    expect(result).toContain("First piece");
    expect(result).toContain("Second piece");
    expect(result).toContain("---");
  });

  it("returns fallback message when no matches", async () => {
    const { querySimilarContent } = await import("@/lib/vector-store");
    vi.mocked(querySimilarContent).mockResolvedValue([]);

    const { buildVoiceContext } = await import("@/lib/voice-rag");
    const result = await buildVoiceContext("test topic", "user-1");

    expect(result).toContain("No voice corpus entries found");
  });

  it("passes userId to querySimilarContent", async () => {
    const { querySimilarContent } = await import("@/lib/vector-store");
    vi.mocked(querySimilarContent).mockResolvedValue([]);

    const { buildVoiceContext } = await import("@/lib/voice-rag");
    await buildVoiceContext("topic", "user-xyz");

    expect(querySimilarContent).toHaveBeenCalledWith("topic", 5, "user-xyz");
  });
});
