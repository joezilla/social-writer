/**
 * Voice Corpus Ingestion Script
 *
 * Usage:
 *   npx tsx scripts/ingest-corpus.ts --file <path> --source <source>
 *   npx tsx scripts/ingest-corpus.ts --url <url> --source <source>
 *   npx tsx scripts/ingest-corpus.ts --dir <directory> --source <source>
 *
 * Options:
 *   --file    Path to a text file to ingest
 *   --url     URL to fetch content from (HTTP only)
 *   --dir     Directory of text files to ingest
 *   --source  Source label (e.g., "linkedin", "medium", "substack")
 *   --title   Optional title for single file/url ingestion
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- Chunking ---

const CHUNK_SIZE = 500; // tokens (approx words)
const CHUNK_OVERLAP = 50;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    if (end === words.length) break;
  }
  return chunks;
}

// --- Embedding via OpenAI ---

async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in environment");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding failed: ${err}`);
  }

  const data = await res.json();
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((item: { embedding: number[] }) => item.embedding);
}

// --- Content Fetching ---

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const html = await res.text();
  // Basic HTML-to-text: strip tags
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function readFile(path: string): Promise<string> {
  const { readFileSync } = await import("fs");
  return readFileSync(path, "utf-8");
}

async function readDir(dirPath: string): Promise<{ name: string; content: string }[]> {
  const { readdirSync, readFileSync } = await import("fs");
  const { join } = await import("path");
  const files = readdirSync(dirPath).filter(
    (f) => f.endsWith(".txt") || f.endsWith(".md")
  );
  return files.map((f) => ({
    name: f.replace(/\.[^.]+$/, ""),
    content: readFileSync(join(dirPath, f), "utf-8"),
  }));
}

// --- Main ---

async function ingest(
  contents: { title: string | null; content: string }[],
  source: string,
  userId: string
) {
  let totalChunks = 0;

  for (const item of contents) {
    const chunks = chunkText(item.content);
    console.log(
      `  "${item.title || "(untitled)"}" → ${chunks.length} chunk(s)`
    );

    // Embed in batches of 50
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50);
      const embeddings = await embedBatch(batch);

      for (let j = 0; j < batch.length; j++) {
        await prisma.voiceCorpusEntry.create({
          data: {
            source,
            title: item.title
              ? `${item.title} (chunk ${i + j + 1}/${chunks.length})`
              : null,
            content: batch[j],
            embedding: Buffer.from(JSON.stringify(embeddings[j])),
            userId,
          },
        });
      }
      totalChunks += batch.length;
    }
  }

  console.log(`\nDone. Ingested ${totalChunks} chunks from ${contents.length} document(s).`);
}

async function main() {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    flags[args[i].replace(/^--/, "")] = args[i + 1];
  }

  const source = flags.source || "manual";
  const userEmail = flags.user;

  if (!userEmail) {
    console.error("--user <email> is required to specify which user's corpus to ingest into");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    console.error(`User not found: ${userEmail}`);
    process.exit(1);
  }

  console.log(`Ingesting for user: ${user.email} (${user.id})`);

  if (flags.file) {
    console.log(`Ingesting file: ${flags.file}`);
    const content = await readFile(flags.file);
    await ingest([{ title: flags.title || flags.file, content }], source, user.id);
  } else if (flags.url) {
    console.log(`Fetching URL: ${flags.url}`);
    const content = await fetchUrl(flags.url);
    await ingest([{ title: flags.title || flags.url, content }], source, user.id);
  } else if (flags.dir) {
    console.log(`Ingesting directory: ${flags.dir}`);
    const files = await readDir(flags.dir);
    await ingest(
      files.map((f) => ({ title: f.name, content: f.content })),
      source,
      user.id
    );
  } else {
    console.log(
      "Usage:\n" +
        "  npx tsx scripts/ingest-corpus.ts --file <path> --source <label> --user <email>\n" +
        "  npx tsx scripts/ingest-corpus.ts --url <url> --source <label> --user <email>\n" +
        "  npx tsx scripts/ingest-corpus.ts --dir <directory> --source <label> --user <email>"
    );
    process.exit(1);
  }

  const count = await prisma.voiceCorpusEntry.count();
  console.log(`Total corpus entries: ${count}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Ingestion error:", err);
  process.exit(1);
});
