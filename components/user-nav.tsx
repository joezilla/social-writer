"use client";

import { signOut } from "next-auth/react";

export function UserNav({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground text-xs">{email}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="px-2 py-1 text-xs rounded-md border hover:bg-muted transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
