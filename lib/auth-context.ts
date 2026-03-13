import { auth } from "@/auth";

interface AuthResult {
  userId: string;
  role: string;
  email: string;
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Unauthorized", 401);
  }
  const user = session.user as { id: string; role: string; email: string };
  return {
    userId: user.id,
    role: user.role,
    email: user.email,
  };
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.role !== "admin") {
    throw new AuthError("Forbidden", 403);
  }
  return result;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
