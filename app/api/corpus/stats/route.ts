import { NextResponse } from "next/server";
import { getCorpusStats } from "@/lib/vector-store";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function GET() {
  try {
    const { userId } = await requireAuth();
    const stats = await getCorpusStats(userId);
    return NextResponse.json(stats);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Corpus stats error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
