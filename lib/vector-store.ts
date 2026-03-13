import { prisma } from "./db";
import { embed, embedSingle, cosineSimilarity } from "./embeddings";

interface CorpusEntry {
  id: string;
  content: string;
  source: string;
  title: string | null;
  similarity: number;
}

// Per-user embedding cache with 5-minute TTL
interface EmbeddingCache {
  entries: {
    id: string;
    content: string;
    source: string;
    title: string | null;
    vec: number[];
  }[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

const globalForVectorStore = globalThis as unknown as {
  embeddingCache: Map<string, EmbeddingCache> | undefined;
};

function getEmbeddingCache(): Map<string, EmbeddingCache> {
  if (!globalForVectorStore.embeddingCache) {
    globalForVectorStore.embeddingCache = new Map();
  }
  return globalForVectorStore.embeddingCache;
}

export async function insertCorpusEntries(
  entries: {
    source: string;
    title?: string;
    content: string;
    publishedAt?: Date;
  }[],
  userId: string
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
          userId,
        },
      });
      inserted++;
    }
  }

  // Invalidate cache for this user
  const cache = getEmbeddingCache();
  cache.delete(userId);

  return inserted;
}

export async function querySimilarContent(
  query: string,
  topK = 5,
  userId: string
): Promise<CorpusEntry[]> {
  const queryVec = await embedSingle(query);
  const cache = getEmbeddingCache();

  let cached = cache.get(userId);
  if (!cached || Date.now() >= cached.expiresAt) {
    // Load from DB
    const allEntries = await prisma.voiceCorpusEntry.findMany({
      where: { userId, embedding: { not: null } },
      select: {
        id: true,
        content: true,
        source: true,
        title: true,
        embedding: true,
      },
    });

    cached = {
      entries: allEntries.map((entry) => ({
        id: entry.id,
        content: entry.content,
        source: entry.source,
        title: entry.title,
        vec: JSON.parse(entry.embedding!.toString()) as number[],
      })),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    cache.set(userId, cached);
  }

  const scored = cached.entries
    .map((entry) => ({
      id: entry.id,
      content: entry.content,
      source: entry.source,
      title: entry.title,
      similarity: cosineSimilarity(queryVec, entry.vec),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

export async function getCorpusStats(userId: string) {
  const total = await prisma.voiceCorpusEntry.count({ where: { userId } });
  const withEmbeddings = await prisma.voiceCorpusEntry.count({
    where: { userId, embedding: { not: null } },
  });

  // Group by source
  const entries = await prisma.voiceCorpusEntry.findMany({
    where: { userId },
    select: { source: true },
  });
  const sourceBreakdown: Record<string, number> = {};
  for (const e of entries) {
    sourceBreakdown[e.source] = (sourceBreakdown[e.source] || 0) + 1;
  }

  const latest = await prisma.voiceCorpusEntry.findFirst({
    where: { userId },
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
