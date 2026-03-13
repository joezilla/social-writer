import { vi } from "vitest";

// Set required env vars before any imports
process.env.LOCAL_ENCRYPTION_SECRET = "test-encryption-secret-32chars!!";
process.env.CRON_SECRET = "test-cron-secret";
process.env.AUTH_SECRET = "test-auth-secret";

// Shared mutable prisma mock — useMockPrisma() replaces its properties each test
export const sharedPrismaMock: Record<string, unknown> = {};

vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrismaMock;
  },
}));

// Shared mutable auth mock
export const sharedAuthMock = { auth: vi.fn() };

vi.mock("@/auth", () => ({
  get auth() {
    return sharedAuthMock.auth;
  },
}));
