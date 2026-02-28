"use client";

import { useEffect, useState } from "react";

interface ImpactData {
  postId: string;
  title: string;
  publishedAt: string;
  topicTags: string;
  followerDelta7d: number | null;
  followerDelta30d: number | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
}

export default function PostImpactCard({ postId }: { postId: string }) {
  const [data, setData] = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/posts/${postId}/impact`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-card animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
        <div className="h-3 bg-muted/60 rounded w-1/2" />
      </div>
    );
  }

  if (!data || data.title === undefined) return null;

  const tags = data.topicTags
    ? data.topicTags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  function formatDelta(val: number | null) {
    if (val === null) return "\u2014";
    return val >= 0 ? `+${val}` : `${val}`;
  }

  function formatNum(val: number | null) {
    if (val === null) return "\u2014";
    return val.toLocaleString();
  }

  return (
    <div className="border rounded-lg p-4 bg-card">
      <h3 className="font-medium text-sm text-card-foreground line-clamp-1">{data.title}</h3>
      <time className="text-xs text-muted-foreground mt-0.5 block">
        {new Date(data.publishedAt).toLocaleDateString()}
      </time>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-muted text-muted-foreground text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="text-center p-2 bg-accent/10 rounded-lg">
          <p className="text-lg font-semibold text-accent tabular-nums">
            {formatDelta(data.followerDelta7d)}
          </p>
          <p className="text-[10px] text-accent/70">7-day followers</p>
        </div>
        <div className="text-center p-2 bg-accent/10 rounded-lg">
          <p className="text-lg font-semibold text-accent tabular-nums">
            {formatDelta(data.followerDelta30d)}
          </p>
          <p className="text-[10px] text-accent/70">30-day followers</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 mt-2 text-center">
        <div>
          <p className="text-sm font-medium tabular-nums">{formatNum(data.impressions)}</p>
          <p className="text-[10px] text-muted-foreground">Views</p>
        </div>
        <div>
          <p className="text-sm font-medium tabular-nums">{formatNum(data.reactions)}</p>
          <p className="text-[10px] text-muted-foreground">Reactions</p>
        </div>
        <div>
          <p className="text-sm font-medium tabular-nums">{formatNum(data.comments)}</p>
          <p className="text-[10px] text-muted-foreground">Comments</p>
        </div>
        <div>
          <p className="text-sm font-medium tabular-nums">{formatNum(data.shares)}</p>
          <p className="text-[10px] text-muted-foreground">Shares</p>
        </div>
      </div>
    </div>
  );
}
