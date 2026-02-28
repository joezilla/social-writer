import { prisma } from "@/lib/db";
import FollowerChart from "@/components/analytics/FollowerChart";
import PostImpactCard from "@/components/analytics/PostImpactCard";
import MonthlyDigest from "@/components/analytics/MonthlyDigest";

export default async function AnalyticsPage() {
  const [snapshots, publishedPosts, latestSnapshot] = await Promise.all([
    prisma.followerSnapshot.findMany({
      orderBy: { capturedAt: "asc" },
      select: { capturedAt: true, followerCount: true },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      select: { id: true, title: true, publishedAt: true, topicTags: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.followerSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
    }),
  ]);

  const chartSnapshots = snapshots.map((s) => ({
    date: s.capturedAt.toISOString(),
    followers: s.followerCount,
  }));

  const chartMarkers = publishedPosts.map((p) => ({
    id: p.id,
    title: p.title,
    publishedAt: p.publishedAt!.toISOString(),
    topicTags: p.topicTags,
  }));

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Impact Tracker</h1>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 text-center bg-card">
          <p className="text-2xl font-bold tabular-nums">
            {latestSnapshot?.followerCount?.toLocaleString() ?? "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">Current Followers</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-card">
          <p className="text-2xl font-bold tabular-nums">{publishedPosts.length}</p>
          <p className="text-xs text-muted-foreground">Published Posts</p>
        </div>
        <div className="border rounded-lg p-4 text-center bg-card">
          <p className="text-2xl font-bold tabular-nums">{snapshots.length}</p>
          <p className="text-xs text-muted-foreground">Data Points</p>
        </div>
      </div>

      {/* Follower Growth Chart */}
      <FollowerChart snapshots={chartSnapshots} postMarkers={chartMarkers} />

      {/* Per-Post Impact Cards */}
      {publishedPosts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Post Impact</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publishedPosts.map((post) => (
              <PostImpactCard key={post.id} postId={post.id} />
            ))}
          </div>
        </section>
      )}

      {/* Monthly Digest */}
      <MonthlyDigest />
    </div>
  );
}
