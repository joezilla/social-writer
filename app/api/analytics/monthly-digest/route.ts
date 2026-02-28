import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateText } from "@/lib/claude";

export async function GET() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recentPosts, followerSnapshots] = await Promise.all([
    prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { gte: thirtyDaysAgo },
      },
      include: {
        analytics: {
          orderBy: { snapshotAt: "desc" },
          take: 1,
        },
      },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.followerSnapshot.findMany({
      where: { capturedAt: { gte: thirtyDaysAgo } },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  const postsForPrompt = recentPosts.map((p) => ({
    title: p.title,
    publishedAt: p.publishedAt?.toISOString(),
    topicTags: p.topicTags,
    impressions: p.analytics[0]?.impressions ?? null,
    reactions: p.analytics[0]?.reactions ?? null,
    comments: p.analytics[0]?.comments ?? null,
    shares: p.analytics[0]?.shares ?? null,
  }));

  const snapshotsForPrompt = followerSnapshots.map((s) => ({
    date: s.capturedAt.toISOString(),
    followerCount: s.followerCount,
  }));

  if (postsForPrompt.length === 0 && snapshotsForPrompt.length === 0) {
    return NextResponse.json({
      digest:
        "No data available yet. Publish posts and run the scraper to start collecting analytics.",
    });
  }

  try {
    const prompt = `Analyze this LinkedIn content performance data and write a brief monthly digest.

PUBLISHED POSTS (last 30 days):
${JSON.stringify(postsForPrompt)}

FOLLOWER GROWTH DATA:
${JSON.stringify(snapshotsForPrompt)}

Write a concise digest (300 words max) covering:
1. Top performing content and why it likely worked
2. Topics/formats that underperformed
3. Follower growth trend and correlation with content
4. 3 specific recommendations for next month's content strategy

Write in the second person ("Your top performer was..."). Be direct and specific.`;

    const digest = await generateText(
      "You are a LinkedIn content analytics expert. Write a clear, actionable monthly digest.",
      prompt,
      1024
    );

    return NextResponse.json({ digest });
  } catch (err) {
    console.error("Monthly digest error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Digest generation failed" },
      { status: 500 }
    );
  }
}
