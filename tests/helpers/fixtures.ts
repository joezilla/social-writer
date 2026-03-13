export const USER_A = {
  id: "user-a-id",
  email: "usera@test.com",
  name: "User A",
  role: "user",
  enabled: true,
  passwordHash: "$2a$12$hashedpassword",
  inviteToken: null,
  inviteExpires: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

export const USER_B = {
  id: "user-b-id",
  email: "userb@test.com",
  name: "User B",
  role: "user",
  enabled: true,
  passwordHash: "$2a$12$hashedpassword",
  inviteToken: null,
  inviteExpires: null,
  createdAt: new Date("2026-01-02"),
  updatedAt: new Date("2026-01-02"),
};

export const ADMIN = {
  id: "admin-id",
  email: "admin@test.com",
  name: "Admin",
  role: "admin",
  enabled: true,
  passwordHash: "$2a$12$hashedpassword",
  inviteToken: null,
  inviteExpires: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

export const POST_A = {
  id: "post-a-id",
  title: "Post by User A",
  body: "This is a post by user A about technology trends.",
  status: "IDEA",
  linkedinPostId: null,
  publishedAt: null,
  topicTags: "tech,ai",
  researchBriefId: null,
  voiceScore: null,
  userId: USER_A.id,
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-01"),
};

export const POST_B = {
  id: "post-b-id",
  title: "Post by User B",
  body: "This is a post by user B about marketing.",
  status: "DRAFTING",
  linkedinPostId: null,
  publishedAt: null,
  topicTags: "marketing",
  researchBriefId: null,
  voiceScore: null,
  userId: USER_B.id,
  createdAt: new Date("2026-02-02"),
  updatedAt: new Date("2026-02-02"),
};

export const RESEARCH_BRIEF = {
  id: "brief-1",
  topic: "AI in Enterprise",
  summary: "AI is transforming enterprise workflows.",
  keyClaims: JSON.stringify([
    { claim: "AI adoption grew 30%", source: "McKinsey", url: "https://example.com" },
  ]),
  sources: JSON.stringify([
    { title: "McKinsey Report", url: "https://example.com", excerpt: "..." },
  ]),
  userId: USER_A.id,
  createdAt: new Date("2026-02-01"),
};

export const CORPUS_ENTRY = {
  id: "corpus-1",
  source: "blog",
  title: "Sample Blog Post",
  content: "This is sample voice corpus content for testing.",
  publishedAt: null,
  embedding: Buffer.from(JSON.stringify(new Array(1536).fill(0.1))),
  userId: USER_A.id,
  createdAt: new Date("2026-01-15"),
};

export const LINKEDIN_TOKEN = {
  id: "token-1",
  accessToken: "encrypted-access-token",
  tokenIv: "abcdef1234567890abcdef12",
  tokenTag: "1234567890abcdef12345678",
  personUrn: "urn:li:person:abc123",
  displayName: "Test User",
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  userId: USER_A.id,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
