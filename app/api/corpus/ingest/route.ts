import { NextRequest, NextResponse } from "next/server";
import { insertCorpusEntries } from "@/lib/vector-store";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();
    const { content, source, title, url } = body;

    if (!source) {
      return NextResponse.json(
        { error: "source is required" },
        { status: 400 }
      );
    }

    let text = content;

    // Fetch from URL if provided instead of content
    if (url && !content) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      } catch (err) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${err instanceof Error ? err.message : err}` },
          { status: 400 }
        );
      }
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "content or url is required" },
        { status: 400 }
      );
    }

    // Chunk the text
    const words = text.split(/\s+/);
    const chunkSize = 500;
    const overlap = 50;
    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push(words.slice(start, end).join(" "));
      start += chunkSize - overlap;
      if (end === words.length) break;
    }

    const inserted = await insertCorpusEntries(
      chunks.map((chunk, i) => ({
        source,
        title: title ? `${title} (chunk ${i + 1}/${chunks.length})` : undefined,
        content: chunk,
      })),
      userId
    );

    return NextResponse.json({ inserted, chunks: chunks.length });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Corpus ingest error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}
