import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateJSON } from "@/lib/claude";

interface FactCheckClaim {
  text: string;
  verdict: "supported" | "unsupported" | "disputed";
  source: string | null;
  sourceUrl: string | null;
  suggestion: string | null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { researchBrief: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!post.body.trim()) {
    return NextResponse.json(
      { error: "Post body is empty" },
      { status: 400 }
    );
  }

  // Get sources from research brief if available
  let sourcesJson = "[]";
  if (post.researchBrief) {
    sourcesJson = post.researchBrief.sources;
  }

  const prompt = `You are a fact-checker. Check each factual claim in the article against the provided research sources.

RESEARCH SOURCES:
${sourcesJson}

ARTICLE TO FACT-CHECK:
${post.body}

For each distinct factual claim in the article, return a JSON object.
Return a JSON array only, no other text:
[
  {
    "text": "<the claim as it appears in the article>",
    "verdict": "supported" | "unsupported" | "disputed",
    "source": "<source title if found>",
    "sourceUrl": "<url if found>",
    "suggestion": "<correction or note if unsupported/disputed>"
  }
]`;

  try {
    const claims = await generateJSON<FactCheckClaim[]>(
      "You are a rigorous fact-checker. Return only valid JSON arrays.",
      prompt,
      2048
    );

    return NextResponse.json({ claims });
  } catch (err) {
    console.error("Fact check error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fact check failed" },
      { status: 500 }
    );
  }
}
