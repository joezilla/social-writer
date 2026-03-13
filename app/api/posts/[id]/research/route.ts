import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateJSON } from "@/lib/claude";
import { searchMultipleQueries, type ExaResult } from "@/lib/exa";
import { requireAuth, AuthError } from "@/lib/auth-context";

interface SynthesizedBrief {
  summary: string;
  keyClaims: { claim: string; source: string; url: string }[];
  counterarguments: string[];
  recommendedAngle: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();

    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { researchBrief: true },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const topic = body.topic || post.title;

    // Step 1: Generate search queries via Claude
    const queries = await generateJSON<string[]>(
      "You are a research query generator. Return only valid JSON.",
      `Generate 4 precise search queries to research this LinkedIn article topic.
The author writes for a senior enterprise technology and marketing audience.
Queries should surface: recent data, expert opinions, contrarian views, and real-world examples.

Topic: ${topic}

Return JSON array of strings only:
["query 1", "query 2", "query 3", "query 4"]`,
      512
    );

    // Step 2: Run queries through Exa
    const searchResults = await searchMultipleQueries(queries, 3);

    // Step 3: Synthesize into structured brief via Claude
    const brief = await generateJSON<SynthesizedBrief>(
      "You are a research assistant. Return only valid JSON.",
      `You are a research assistant synthesizing web search results into a structured brief
for a senior technology executive writing a LinkedIn article.

TOPIC: ${topic}

SEARCH RESULTS:
${JSON.stringify(searchResults)}

Return JSON only:
{
  "summary": "<2-3 sentence executive summary of the landscape>",
  "keyClaims": [
    { "claim": "<key finding>", "source": "<source name>", "url": "<url>" }
  ],
  "counterarguments": ["<counterpoint 1>", "<counterpoint 2>"],
  "recommendedAngle": "<suggested unique angle given the research>"
}`,
      2048
    );

    // Step 4: Save to database
    const sources = searchResults.map((r: ExaResult) => ({
      title: r.title,
      url: r.url,
      excerpt: r.excerpt,
    }));

    const researchBrief = await prisma.researchBrief.create({
      data: {
        topic,
        summary: brief.summary,
        keyClaims: JSON.stringify(brief.keyClaims),
        sources: JSON.stringify(sources),
        userId,
      },
    });

    // Link to post
    await prisma.post.update({
      where: { id: params.id },
      data: {
        researchBriefId: researchBrief.id,
        status: post.status === "IDEA" ? "RESEARCHING" : post.status,
      },
    });

    return NextResponse.json({
      id: researchBrief.id,
      topic,
      summary: brief.summary,
      keyClaims: brief.keyClaims,
      counterarguments: brief.counterarguments,
      recommendedAngle: brief.recommendedAngle,
      sources,
      queriesUsed: queries,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Research brief error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research generation failed" },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();

    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { researchBrief: true },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.researchBrief) {
      return NextResponse.json({ brief: null });
    }

    const brief = post.researchBrief;
    return NextResponse.json({
      id: brief.id,
      topic: brief.topic,
      summary: brief.summary,
      keyClaims: JSON.parse(brief.keyClaims),
      sources: JSON.parse(brief.sources),
      createdAt: brief.createdAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
