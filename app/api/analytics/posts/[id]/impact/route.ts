import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      topicTags: true,
      status: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status !== "PUBLISHED" || !post.publishedAt) {
    return NextResponse.json(
      { error: "Post is not published" },
      { status: 400 }
    );
  }

  // Get latest analytics snapshot for this post
  const latestAnalytics = await prisma.postAnalytics.findFirst({
    where: { postId: post.id },
    orderBy: { snapshotAt: "desc" },
  });

  // Calculate follower deltas
  const publishDate = post.publishedAt;
  const sevenDaysAfter = new Date(publishDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAfter = new Date(publishDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Find closest FollowerSnapshot to publish date
  const atPublish = await prisma.followerSnapshot.findFirst({
    where: {
      capturedAt: {
        gte: new Date(publishDate.getTime() - 24 * 60 * 60 * 1000),
        lte: new Date(publishDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { capturedAt: "asc" },
  });

  // Find closest to 7 days after
  const at7Days = await prisma.followerSnapshot.findFirst({
    where: {
      capturedAt: {
        gte: new Date(sevenDaysAfter.getTime() - 24 * 60 * 60 * 1000),
        lte: new Date(sevenDaysAfter.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { capturedAt: "asc" },
  });

  // Find closest to 30 days after
  const at30Days = await prisma.followerSnapshot.findFirst({
    where: {
      capturedAt: {
        gte: new Date(thirtyDaysAfter.getTime() - 24 * 60 * 60 * 1000),
        lte: new Date(thirtyDaysAfter.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { capturedAt: "asc" },
  });

  const followerDelta7d =
    atPublish && at7Days
      ? at7Days.followerCount - atPublish.followerCount
      : null;

  const followerDelta30d =
    atPublish && at30Days
      ? at30Days.followerCount - atPublish.followerCount
      : null;

  return NextResponse.json({
    postId: post.id,
    title: post.title,
    publishedAt: post.publishedAt.toISOString(),
    topicTags: post.topicTags,
    followerDelta7d,
    followerDelta30d,
    impressions: latestAnalytics?.impressions ?? null,
    reactions: latestAnalytics?.reactions ?? null,
    comments: latestAnalytics?.comments ?? null,
    shares: latestAnalytics?.shares ?? null,
  });
}
