import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStoredToken, publishPost } from "@/lib/linkedin";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAuth();

    const post = await prisma.post.findUnique({
      where: { id: params.id },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.body.trim()) {
      return NextResponse.json(
        { error: "Post body is empty" },
        { status: 400 }
      );
    }

    const token = await getStoredToken(userId);
    if (!token) {
      return NextResponse.json(
        { error: "LinkedIn not connected" },
        { status: 401 }
      );
    }

    if (token.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "LinkedIn token expired" },
        { status: 401 }
      );
    }

    const linkedinPostId = await publishPost(
      token.accessToken,
      token.personUrn,
      post.body
    );

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        status: "PUBLISHED",
        linkedinPostId,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Publish error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 }
    );
  }
}
