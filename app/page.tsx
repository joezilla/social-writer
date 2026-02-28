import { prisma } from "@/lib/db";
import dynamic from "next/dynamic";

const KanbanBoard = dynamic(
  () => import("@/components/pipeline/KanbanBoard"),
  { ssr: false }
);

export default async function Home() {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const serialized = posts.map((p) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    status: p.status,
    topicTags: p.topicTags,
    voiceScore: p.voiceScore,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="max-w-[1400px] mx-auto py-6 px-4 sm:px-6">
      <KanbanBoard initialPosts={serialized} />
    </div>
  );
}
