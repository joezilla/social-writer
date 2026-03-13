import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMockPrisma } from "../helpers/mock-prisma";
import { mockAsUser, mockUnauthed } from "../helpers/mock-auth";
import { createRequest, parseResponse } from "../helpers/mock-request";
import { POST_A, USER_A } from "../helpers/fixtures";

vi.mock("@/lib/claude", () => ({
  generateText: vi.fn().mockResolvedValue("AI generated draft content here."),
}));

vi.mock("@/lib/voice-rag", () => ({
  buildVoiceContext: vi.fn().mockResolvedValue("Voice context samples"),
}));

describe("POST /api/posts/[id]/generate-draft", () => {
  let mockPrisma: ReturnType<typeof useMockPrisma>;
  const params = { params: { id: POST_A.id } };

  beforeEach(() => {
    vi.resetModules();
    mockPrisma = useMockPrisma();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthed();
    const { POST } = await import("@/app/api/posts/[id]/generate-draft/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/generate-draft`);
    const res = await POST(req, params);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 404 for another user's post", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      userId: "other-user",
    });

    const { POST } = await import("@/app/api/posts/[id]/generate-draft/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/generate-draft`);
    const res = await POST(req, params);
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("generates draft and changes IDEA to DRAFTING", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      body: "",
      status: "IDEA",
      researchBrief: null,
    });
    mockPrisma.post.update.mockResolvedValue({
      ...POST_A,
      body: "AI generated draft content here.",
      status: "DRAFTING",
    });

    const { POST } = await import("@/app/api/posts/[id]/generate-draft/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/generate-draft`, {});
    const res = await POST(req, params);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.draft).toBe("AI generated draft content here.");
    expect(mockPrisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DRAFTING" }),
      })
    );
  });

  it("passes userId to buildVoiceContext", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      body: "",
      researchBrief: null,
    });
    mockPrisma.post.update.mockResolvedValue(POST_A);

    const { POST } = await import("@/app/api/posts/[id]/generate-draft/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/generate-draft`, {});
    await POST(req, params);

    const { buildVoiceContext } = await import("@/lib/voice-rag");
    expect(buildVoiceContext).toHaveBeenCalledWith(POST_A.title, USER_A.id);
  });

  it("creates PostVersion when existing body is non-empty", async () => {
    mockAsUser(USER_A.id, USER_A.email);
    mockPrisma.post.findUnique.mockResolvedValue({
      ...POST_A,
      body: "Old draft content",
      researchBrief: null,
    });
    mockPrisma.postVersion.create.mockResolvedValue({});
    mockPrisma.post.update.mockResolvedValue(POST_A);

    const { POST } = await import("@/app/api/posts/[id]/generate-draft/route");
    const req = createRequest("POST", `/api/posts/${POST_A.id}/generate-draft`, {});
    await POST(req, params);

    expect(mockPrisma.postVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        postId: POST_A.id,
        body: "Old draft content",
      }),
    });
  });
});
