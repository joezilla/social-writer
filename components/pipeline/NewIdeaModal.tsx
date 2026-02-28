"use client";

import { useState, useEffect, useRef } from "react";

interface NewIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewIdeaModal({
  open,
  onClose,
  onCreated,
}: NewIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [topicTags, setTopicTags] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to wait for render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), topicTags }),
      });
      if (res.ok) {
        setTitle("");
        setTopicTags("");
        onCreated();
        onClose();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New idea"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-card rounded-xl shadow-2xl p-6 w-full max-w-md border overscroll-contain">
        <h2 className="text-lg font-semibold mb-4 text-balance">New Idea</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="idea-title"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Title
            </label>
            <input
              ref={inputRef}
              id="idea-title"
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What\u2019s the idea\u2026"
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background placeholder:text-muted-foreground/60 focus-ring transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="idea-tags"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Tags
              <span className="font-normal text-muted-foreground ml-1">(optional)</span>
            </label>
            <input
              id="idea-tags"
              type="text"
              name="tags"
              value={topicTags}
              onChange={(e) => setTopicTags(e.target.value)}
              placeholder="ai, leadership, strategy\u2026"
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background placeholder:text-muted-foreground/60 focus-ring transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors focus-ring"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || creating}
              className="px-4 py-2 text-sm bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-ring"
            >
              {creating ? "Creating\u2026" : "Create Idea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
