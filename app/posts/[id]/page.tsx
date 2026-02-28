import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import PostEditor from "@/components/editor/PostEditor";

export default async function PostPage({
  params,
}: {
  params: { id: string };
}) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { researchBrief: true },
  });

  if (!post) notFound();

  let researchBrief = null;
  if (post.researchBrief) {
    const brief = post.researchBrief;
    researchBrief = {
      id: brief.id,
      topic: brief.topic,
      summary: brief.summary,
      keyClaims: JSON.parse(brief.keyClaims),
      sources: JSON.parse(brief.sources),
    };
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <PostEditor
        post={{
          id: post.id,
          title: post.title,
          body: post.body,
          status: post.status,
          topicTags: post.topicTags,
          voiceScore: post.voiceScore,
          publishedAt: post.publishedAt?.toISOString() ?? null,
        }}
        researchBrief={researchBrief}
      />
    </div>
  );
}
