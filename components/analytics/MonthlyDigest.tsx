"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function MonthlyDigest() {
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/monthly-digest");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate digest");
        return;
      }
      setDigest(data.digest);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!digest) return;
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Monthly Digest</h2>
        <div className="flex gap-2">
          {digest && (
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors focus-ring"
              aria-label="Copy digest to clipboard"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring"
          >
            {loading ? "Generating\u2026" : "Generate Monthly Digest"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      {digest ? (
        <div className="prose prose-sm max-w-none bg-muted/50 rounded-lg p-4">
          <ReactMarkdown>{digest}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Generate a digest to see AI-powered analysis of your last 30 days of
          content performance.
        </p>
      )}
    </div>
  );
}
