import { vi } from "vitest";
import { sharedPrismaMock } from "../setup";

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}

export function createMockPrisma() {
  return {
    user: createModelMock(),
    post: createModelMock(),
    postVersion: createModelMock(),
    postAnalytics: createModelMock(),
    voiceCorpusEntry: createModelMock(),
    appSetting: createModelMock(),
    userSetting: createModelMock(),
    linkedInToken: createModelMock(),
    scheduledPost: createModelMock(),
    researchBrief: createModelMock(),
    followerSnapshot: createModelMock(),
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;

/**
 * Install a mock prisma instance into the mocked @/lib/db module.
 * Returns the mock for assertions.
 */
export function useMockPrisma(): MockPrisma {
  const mock = createMockPrisma();
  // Clear old properties and assign new mock
  for (const key of Object.keys(sharedPrismaMock)) {
    delete sharedPrismaMock[key];
  }
  Object.assign(sharedPrismaMock, mock);
  return mock;
}
