"use client";

import Link from "next/link";

interface Post {
  id: string;
  title: string;
  topicTags: string;
  voiceScore: number | null;
  updatedAt: string;
}

interface KanbanCardProps {
  post: Post;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export default function KanbanCard({
  post,
  onDelete,
  onDuplicate,
}: KanbanCardProps) {
  const tags = post.topicTags
    ? post.topicTags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return (
    <div className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow duration-150 group">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/posts/${post.id}`}
          className="font-medium text-sm text-card-foreground hover:text-accent line-clamp-2 flex-1 min-w-0 focus-ring rounded-sm transition-colors"
        >
          {post.title || "Untitled"}
        </Link>
        {post.voiceScore !== null && (
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
              post.voiceScore >= 75
                ? "bg-emerald-500"
                : post.voiceScore >= 50
                ? "bg-amber-500"
                : "bg-red-500"
            }`}
            role="img"
            aria-label={`Voice score: ${post.voiceScore}`}
          />
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[11px] rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
        <time className="text-[11px] text-muted-foreground tabular-nums">
          {new Date(post.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </time>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Link
            href={`/posts/${post.id}`}
            className="text-[11px] text-accent hover:text-accent/80 px-1.5 py-0.5 rounded focus-ring transition-colors"
          >
            Open
          </Link>
          <button
            onClick={() => onDuplicate(post.id)}
            className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded focus-ring transition-colors"
            aria-label={`Duplicate "${post.title}"`}
          >
            Duplicate
          </button>
          <button
            onClick={() => onDelete(post.id)}
            className="text-[11px] text-destructive/70 hover:text-destructive px-1.5 py-0.5 rounded focus-ring transition-colors"
            aria-label={`Delete "${post.title}"`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
