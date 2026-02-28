import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [
    latestSnapshot,
    snapshotCount,
    publishedCount,
    totalImpressions,
    snapshots,
  ] = await Promise.all([
    prisma.followerSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
    }),
    prisma.followerSnapshot.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.postAnalytics.aggregate({ _sum: { impressions: true } }),
    prisma.followerSnapshot.findMany({
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, followerCount: true },
    }),
  ]);

  // Published posts with dates for chart markers
  const publishedPosts = await prisma.post.findMany({
    where: { status: "PUBLISHED", publishedAt: { not: null } },
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
}
