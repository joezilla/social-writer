import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { title, topicTags } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        topicTags: topicTags || "",
        userId,
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function GET() {
  try {
    const { userId } = await requireAuth();
    const posts = await prisma.post.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(posts);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
