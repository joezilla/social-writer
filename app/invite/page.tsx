"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to accept invite");
      return;
    }

    router.push("/login");
  }

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-muted-foreground">Invalid invite link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Set Your Password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your account setup
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-md border bg-background text-sm focus-ring"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
