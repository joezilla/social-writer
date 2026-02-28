import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, topicTags } = body;

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      title: title.trim(),
      topicTags: topicTags || "",
    },
  });

  return NextResponse.json(post, { status: 201 });
}

export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(posts);
}
