import { prisma } from "./db";
import { embed, embedSingle, cosineSimilarity } from "./embeddings";

interface CorpusEntry {
  id: string;
  content: string;
  source: string;
  title: string | null;
  similarity: number;
}

export async function insertCorpusEntries(
  entries: {
    source: string;
    title?: string;
    content: string;
    publishedAt?: Date;
  }[]
): Promise<number> {
  // Embed all texts in a batch (max 2048 per OpenAI call)
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const texts = batch.map((e) => e.content);
    const embeddings = await embed(texts);

    for (let j = 0; j < batch.length; j++) {
      await prisma.voiceCorpusEntry.create({
        data: {
          source: batch[j].source,
          title: batch[j].title ?? null,
          content: batch[j].content,
          publishedAt: batch[j].publishedAt ?? null,
          embedding: Buffer.from(JSON.stringify(embeddings[j])),
        },
      });
      inserted++;
    }
  }

  return inserted;
}

export async function querySimilarContent(
  query: string,
  topK = 5
): Promise<CorpusEntry[]> {
  const queryVec = await embedSingle(query);

  const allEntries = await prisma.voiceCorpusEntry.findMany({
    where: { embedding: { not: null } },
    select: {
      id: true,
      content: true,
      source: true,
      title: true,
      embedding: true,
    },
  });

  const scored = allEntries
    .map((entry) => {
      const vec = JSON.parse(entry.embedding!.toString()) as number[];
      return {
        id: entry.id,
        content: entry.content,
        source: entry.source,
        title: entry.title,
        similarity: cosineSimilarity(queryVec, vec),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

export async function getCorpusStats() {
  const total = await prisma.voiceCorpusEntry.count();
  const withEmbeddings = await prisma.voiceCorpusEntry.count({
    where: { embedding: { not: null } },
  });

  // Group by source
  const entries = await prisma.voiceCorpusEntry.findMany({
    select: { source: true },
  });
  const sourceBreakdown: Record<string, number> = {};
  for (const e of entries) {
    sourceBreakdown[e.source] = (sourceBreakdown[e.source] || 0) + 1;
  }

  const latest = await prisma.voiceCorpusEntry.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    total,
    withEmbeddings,
    sourceBreakdown,
    lastUpdated: latest?.createdAt?.toISOString() ?? null,
  };
}
