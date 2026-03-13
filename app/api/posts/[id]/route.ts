import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-context";

async function getOwnedPost(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });
  if (!post) return null;
  if (post.userId !== userId) return null;
  return post;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(post);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { title, body: postBody, status, topicTags, voiceScore } = body;

    const existing = await getOwnedPost(params.id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Create a PostVersion if body changed
    if (postBody !== undefined && postBody !== existing.body) {
      await prisma.postVersion.create({
        data: {
          postId: params.id,
          body: existing.body,
          note: "Auto-save",
        },
      });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (postBody !== undefined) updateData.body = postBody;
    if (status !== undefined) updateData.status = status;
    if (topicTags !== undefined) updateData.topicTags = topicTags;
    if (voiceScore !== undefined) updateData.voiceScore = voiceScore;

    const post = await prisma.post.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(post);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();
    const existing = await getOwnedPost(params.id, userId);
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await prisma.post.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
