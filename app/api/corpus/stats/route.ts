import { NextResponse } from "next/server";
import { getCorpusStats } from "@/lib/vector-store";

export async function GET() {
  try {
    const stats = await getCorpusStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("Corpus stats error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get stats" },
      { status: 500 }
    );
  }
}
