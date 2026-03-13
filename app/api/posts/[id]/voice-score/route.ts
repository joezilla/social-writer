import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateJSON } from "@/lib/claude";
import { requireAuth, AuthError } from "@/lib/auth-context";

interface VoiceScoreResult {
  score: number;
  flaggedPhrases: string[];
  reasoning: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();

    const post = await prisma.post.findUnique({
      where: { id: params.id },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.body.trim()) {
      return NextResponse.json(
        { error: "Post body is empty" },
        { status: 400 }
      );
    }

    const prompt = `You are evaluating whether this article draft matches a specific author's voice.

VOICE CHARACTERISTICS TO EVALUATE AGAINST:
- Direct, analytical, concrete
- Varies sentence length for rhythm
- Avoids corporate buzzwords
- First-person perspective
- Strong hooks, no preambles
- Challenges conventional thinking

DRAFT TO EVALUATE:
${post.body}

Return JSON only, no other text:
{
  "score": <number 0-100>,
  "flaggedPhrases": [<phrases that don't match the voice>],
  "reasoning": "<one sentence explanation>"
}`;

    const result = await generateJSON<VoiceScoreResult>(
      "You are a voice analysis expert. Return only valid JSON.",
      prompt,
      1024
    );

    // Persist the score
    await prisma.post.update({
      where: { id: params.id },
      data: { voiceScore: result.score },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Voice score error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Voice scoring failed" },
      { status: 500 }
    );
  }
}
