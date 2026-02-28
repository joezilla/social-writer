import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/claude";
import { buildVoiceContext } from "@/lib/voice-rag";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      researchBrief: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const targetLength = body.targetLength || 600;
  const angle = body.angle || "";

  // Build voice context from corpus
  const voiceContext = await buildVoiceContext(post.title);

  // Build research context if available
  let briefSummary = "";
  let keyClaims = "";
  if (post.researchBrief) {
    briefSummary = post.researchBrief.summary;
    try {
      const claims = JSON.parse(post.researchBrief.keyClaims);
      keyClaims = claims.map((c: { claim: string }) => c.claim).join(", ");
    } catch {
      keyClaims = post.researchBrief.keyClaims;
    }
  }

  const systemPrompt = `You are a writing assistant for a specific author.
Your sole job is to write in their exact voice — not a generic AI voice, not a polished corporate voice, theirs.

VOICE PROFILE (derived from their actual writing):
- Analytical and direct. States positions clearly without hedging excessively.
- Uses concrete examples and analogies from technology and business history.
- Sentences vary in length. Short declarative sentences for emphasis. Longer sentences for building arguments.
- Occasionally provocative — willing to challenge conventional wisdom in enterprise tech and marketing.
- Never uses corporate buzzwords without immediately interrogating them.
- First person. Personal perspective. Not "organizations should" — "I've seen this fail."
- Opening lines are hooks, not preambles. Never starts with "In today's rapidly changing landscape."
- Closing lines invite reflection or debate, not a summary recap.

SAMPLE WRITING FOR VOICE CALIBRATION:
${voiceContext}

Write a LinkedIn article draft on the following topic. Match the author's voice exactly.
Return only the article content — no preamble, no explanation, no "Here is your draft."`;

  const userPrompt = `Topic: ${post.title}
${angle ? `Angle: ${angle}` : ""}
${briefSummary ? `Research brief summary: ${briefSummary}` : ""}
${keyClaims ? `Key points to incorporate: ${keyClaims}` : ""}
Target length: ${targetLength} words`;

  try {
    const draft = await generateText(systemPrompt, userPrompt, 4096);

    // Save the draft to the post and create a version of the old body
    if (post.body.trim()) {
      await prisma.postVersion.create({
        data: {
          postId: post.id,
          body: post.body,
          note: "Before AI draft generation",
        },
      });
    }

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        body: draft,
        status: post.status === "IDEA" ? "DRAFTING" : post.status,
      },
    });

    return NextResponse.json({
      draft,
      wordCount: draft.trim().split(/\s+/).length,
      postId: updated.id,
    });
  } catch (err) {
    console.error("Draft generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 }
    );
  }
}
