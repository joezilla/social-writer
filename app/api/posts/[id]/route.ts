import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const { title, body: postBody, status, topicTags, voiceScore } = body;

  const existing = await prisma.post.findUnique({
    where: { id: params.id },
  });

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
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.post.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
