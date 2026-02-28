import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ResearchPage({
  params,
}: {
  params: { id: string };
}) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { researchBrief: true },
  });

  if (!post) notFound();

  const brief = post.researchBrief;
  const keyClaims = brief ? JSON.parse(brief.keyClaims) : [];
  const sources = brief ? JSON.parse(brief.sources) : [];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/posts/${post.id}`}
            className="text-sm text-accent hover:text-accent/80 transition-colors focus-ring rounded-sm"
          >
            &larr; Back to Editor
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2 text-balance">Research Brief</h1>
          <p className="text-muted-foreground text-sm">{post.title}</p>
        </div>
      </div>

      {!brief ? (
        <div className="border rounded-lg p-8 text-center bg-card">
          <p className="text-muted-foreground mb-4">
            No research brief has been generated yet.
          </p>
          <Link
            href={`/posts/${post.id}`}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 text-sm transition-opacity focus-ring inline-block"
          >
            Go to Editor to Generate
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Summary</h2>
            <p className="text-foreground/80 leading-relaxed">{brief.summary}</p>
          </section>

          {/* Topic */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Topic</h2>
            <p className="text-foreground/80">{brief.topic}</p>
          </section>

          {/* Key Claims */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Key Claims ({keyClaims.length})
            </h2>
            <div className="space-y-3">
              {keyClaims.map(
                (
                  claim: { claim: string; source: string; url: string },
                  i: number
                ) => (
                  <div key={i} className="border rounded-lg p-4 bg-card">
                    <p className="text-foreground font-medium">{claim.claim}</p>
                    {claim.source && (
                      <a
                        href={claim.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-accent hover:text-accent/80 mt-1 inline-block transition-colors focus-ring rounded-sm"
                      >
                        Source: {claim.source}
                      </a>
                    )}
                  </div>
                )
              )}
            </div>
          </section>

          {/* Sources */}
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Sources ({sources.length})
            </h2>
            <div className="space-y-3">
              {sources.map(
                (
                  source: { title: string; url: string; excerpt: string },
                  i: number
                ) => (
                  <div key={i} className="border rounded-lg p-4 bg-card">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 font-medium transition-colors focus-ring rounded-sm"
                    >
                      {source.title || source.url}
                    </a>
                    {source.excerpt && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                        {source.excerpt}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          </section>

          {/* Metadata */}
          <section className="text-xs text-muted-foreground border-t border-border pt-4">
            Generated: {brief.createdAt.toLocaleString()}
          </section>
        </div>
      )}
    </div>
  );
}
