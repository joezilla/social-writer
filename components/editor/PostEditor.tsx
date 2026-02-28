"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import VoiceScorePanel from "./VoiceScorePanel";
import ResearchBriefPanel from "./ResearchBriefPanel";
import FactCheckPanel from "./FactCheckPanel";

const STATUSES = [
  "IDEA",
  "RESEARCHING",
  "DRAFTING",
  "REVIEW",
  "SCHEDULED",
  "PUBLISHED",
] as const;

interface PostData {
  id: string;
  title: string;
  body: string;
  status: string;
  topicTags: string;
  voiceScore: number | null;
  publishedAt: string | null;
}

interface BriefData {
  id: string;
  topic: string;
  summary: string;
  keyClaims: { claim: string; source: string; url: string }[];
  sources: { title: string; url: string; excerpt: string }[];
}

export default function PostEditor({
  post,
  researchBrief,
}: {
  post: PostData;
  researchBrief?: BriefData | null;
}) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [status, setStatus] = useState(post.status);
  const [topicTags, setTopicTags] = useState(post.topicTags);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generateCooldown = useRef(false);

  const dirtyRef = useRef(false);
  const bodyRef = useRef(body);
  const titleRef = useRef(title);
  const tagsRef = useRef(topicTags);

  useEffect(() => {
    bodyRef.current = body;
    titleRef.current = title;
    tagsRef.current = topicTags;
    dirtyRef.current = true;
  }, [body, title, topicTags]);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaving(true);
    try {
      await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleRef.current,
          body: bodyRef.current,
          topicTags: tagsRef.current,
        }),
      });
      setLastSaved(new Date());
    } catch {
      dirtyRef.current = true;
    } finally {
      setSaving(false);
    }
  }, [post.id]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(save, 30000);
    return () => clearInterval(interval);
  }, [save]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (dirtyRef.current) save();
    };
  }, [save]);

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handlePublish() {
    setShowPublishConfirm(false);
    setPublishing(true);
    setPublishError(null);

    // Save first
    await save();

    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setPublishError(data.error || "Publish failed");
        return;
      }

      setStatus("PUBLISHED");
    } catch {
      setPublishError("Network error");
    } finally {
      setPublishing(false);
    }
  }

  async function handleGenerateDraft() {
    if (generateCooldown.current) return;
    generateCooldown.current = true;
    setTimeout(() => { generateCooldown.current = false; }, 2000);

    setGenerating(true);
    setGenerateError(null);

    // Save current content first
    await save();

    try {
      const res = await fetch(`/api/posts/${post.id}/generate-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLength: 600 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setGenerateError(data.error || "Generation failed");
        return;
      }

      setBody(data.draft);
      bodyRef.current = data.draft;
      dirtyRef.current = false; // Server already saved it
      setLastSaved(new Date());
      if (status === "IDEA") setStatus("DRAFTING");
    } catch {
      setGenerateError("Network error");
    } finally {
      setGenerating(false);
    }
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main editor */}
      <div className="lg:col-span-2 space-y-4">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title\u2026"
          className="w-full text-2xl font-bold border-0 border-b border-border pb-2 bg-transparent focus-ring rounded-sm transition-colors"
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPreview(false)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors focus-ring ${
                !showPreview
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Write
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors focus-ring ${
                showPreview
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              Preview
            </button>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {saving && <span>Saving\u2026</span>}
            {lastSaved && !saving && (
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            )}
            <button
              onClick={save}
              className="px-2 py-1 text-xs border rounded-md hover:bg-muted transition-colors focus-ring"
            >
              Save now
            </button>
          </div>
        </div>

        {/* Body editor / preview */}
        {showPreview ? (
          <div className="prose max-w-none min-h-[400px] border rounded-lg p-4 bg-muted/50">
            <ReactMarkdown>{body || "*Nothing to preview*"}</ReactMarkdown>
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post content here\u2026 (Markdown supported)"
            className="w-full min-h-[400px] border rounded-lg p-4 font-mono text-sm bg-background resize-y focus-ring transition-colors placeholder:text-muted-foreground/60"
          />
        )}

        {/* Footer stats */}
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
          <span className="tabular-nums">
            {wordCount} words &middot; {readTime} min read
          </span>
          {post.voiceScore !== null && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium tabular-nums ${
                post.voiceScore >= 75
                  ? "bg-emerald-100 text-emerald-800"
                  : post.voiceScore >= 50
                  ? "bg-amber-100 text-amber-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Voice: {post.voiceScore}
            </span>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="space-y-4">
        {/* Status */}
        <div className="border rounded-lg p-4 bg-card">
          <label
            htmlFor="post-status"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Status
          </label>
          <select
            id="post-status"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus-ring transition-colors"
            disabled={status === "PUBLISHED"}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Topic Tags */}
        <div className="border rounded-lg p-4 bg-card">
          <label
            htmlFor="post-tags"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Topic Tags
          </label>
          <input
            id="post-tags"
            type="text"
            value={topicTags}
            onChange={(e) => setTopicTags(e.target.value)}
            placeholder="comma, separated, tags"
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus-ring transition-colors placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Publish */}
        <div className="border rounded-lg p-4 bg-card">
          {status === "PUBLISHED" ? (
            <div className="text-center">
              <p className="text-sm font-medium text-emerald-700">Published</p>
              {post.publishedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(post.publishedAt).toLocaleString()}
                </p>
              )}
            </div>
          ) : showPublishConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                Publish this post to LinkedIn?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex-1 px-3 py-2 bg-accent text-accent-foreground text-sm rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-ring"
                >
                  {publishing ? "Publishing\u2026" : "Confirm"}
                </button>
                <button
                  onClick={() => setShowPublishConfirm(false)}
                  className="flex-1 px-3 py-2 border text-sm rounded-lg hover:bg-muted transition-colors focus-ring"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPublishConfirm(true)}
              className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity focus-ring"
            >
              Publish Now
            </button>
          )}
          {publishError && (
            <p className="text-sm text-destructive mt-2">{publishError}</p>
          )}
        </div>

        {/* Generate Draft */}
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="text-sm font-medium text-foreground mb-3">
            AI Draft Generation
          </h3>
          <button
            onClick={handleGenerateDraft}
            disabled={generating || !title.trim()}
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors focus-ring"
          >
            {generating ? "Generating\u2026" : "Generate Draft"}
          </button>
          {generateError && (
            <p className="text-sm text-destructive mt-2">{generateError}</p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Uses your voice corpus to generate a draft matching your writing style
          </p>
        </div>

        {/* Voice Score */}
        <VoiceScorePanel postId={post.id} />

        {/* Research Brief */}
        <ResearchBriefPanel
          postId={post.id}
          initialBrief={researchBrief ?? null}
        />

        {/* Fact Check */}
        <FactCheckPanel postId={post.id} />
      </div>
    </div>
  );
}
