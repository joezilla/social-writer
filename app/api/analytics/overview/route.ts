import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function GET() {
  try {
    const { userId } = await requireAuth();

    const [
      latestSnapshot,
      snapshotCount,
      publishedCount,
      totalImpressions,
      snapshots,
    ] = await Promise.all([
      prisma.followerSnapshot.findFirst({
        where: { userId },
        orderBy: { capturedAt: "desc" },
      }),
      prisma.followerSnapshot.count({ where: { userId } }),
      prisma.post.count({ where: { userId, status: "PUBLISHED" } }),
      prisma.postAnalytics.aggregate({
        where: { post: { userId } },
        _sum: { impressions: true },
      }),
      prisma.followerSnapshot.findMany({
        where: { userId },
        orderBy: { capturedAt: "asc" },
        select: { capturedAt: true, followerCount: true },
      }),
    ]);

    // Published posts with dates for chart markers
    const publishedPosts = await prisma.post.findMany({
      where: { userId, status: "PUBLISHED", publishedAt: { not: null } },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        topicTags: true,
      },
      orderBy: { publishedAt: "desc" },
    });

    return NextResponse.json({
      currentFollowers: latestSnapshot?.followerCount ?? null,
      snapshotCount,
      publishedCount,
      totalImpressions: totalImpressions._sum.impressions ?? 0,
      snapshots: snapshots.map((s) => ({
        date: s.capturedAt.toISOString(),
        followers: s.followerCount,
      })),
      publishedPosts: publishedPosts.map((p) => ({
        id: p.id,
        title: p.title,
        publishedAt: p.publishedAt!.toISOString(),
        topicTags: p.topicTags,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
