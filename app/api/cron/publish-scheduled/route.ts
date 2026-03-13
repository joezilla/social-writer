import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStoredToken, publishPost } from "@/lib/linkedin";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const pending = await prisma.scheduledPost.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: now },
    },
    include: {
      user: true,
    },
  });

  const results: { postId: string; success: boolean; error?: string }[] = [];

  for (const scheduled of pending) {
    try {
      const post = await prisma.post.findUnique({
        where: { id: scheduled.postId },
      });

      if (!post || !post.body.trim()) {
        await prisma.scheduledPost.update({
          where: { id: scheduled.id },
          data: { status: "failed" },
        });
        results.push({ postId: scheduled.postId, success: false, error: "Post not found or empty" });
        continue;
      }

      const token = await getStoredToken(scheduled.userId);
      if (!token || token.expiresAt < now) {
        await prisma.scheduledPost.update({
          where: { id: scheduled.id },
          data: { status: "failed" },
        });
        results.push({ postId: scheduled.postId, success: false, error: "No valid LinkedIn token" });
        continue;
      }

      const linkedinPostId = await publishPost(
        token.accessToken,
        token.personUrn,
        post.body
      );

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "PUBLISHED",
          linkedinPostId,
          publishedAt: now,
        },
      });

      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: { status: "published" },
      });

      results.push({ postId: scheduled.postId, success: true });
    } catch (err) {
      console.error(`Failed to publish scheduled post ${scheduled.postId}:`, err);
      await prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: { status: "failed" },
      });
      results.push({
        postId: scheduled.postId,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
