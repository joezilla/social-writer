import { vi } from "vitest";
import { sharedAuthMock } from "../setup";

export function mockAsUser(id = "user-a-id", email = "usera@test.com") {
  sharedAuthMock.auth.mockResolvedValue({
    user: { id, email, role: "user" },
  });
}

export function mockAsAdmin(id = "admin-id", email = "admin@test.com") {
  sharedAuthMock.auth.mockResolvedValue({
    user: { id, email, role: "admin" },
  });
}

export function mockUnauthed() {
  sharedAuthMock.auth.mockResolvedValue(null);
}
