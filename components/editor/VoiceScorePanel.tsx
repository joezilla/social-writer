"use client";

import { useState } from "react";

interface VoiceScoreResult {
  score: number;
  flaggedPhrases: string[];
  reasoning: string;
}

export default function VoiceScorePanel({ postId }: { postId: string }) {
  const [result, setResult] = useState<VoiceScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScore() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/voice-score`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scoring failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = result
    ? result.score >= 75
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : result.score >= 50
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200"
    : "";

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Voice Score</h3>
        <button
          onClick={handleScore}
          disabled={loading}
          className="px-3 py-1 text-xs bg-muted rounded-md hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring"
        >
          {loading ? "Scoring\u2026" : "Score Draft"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className={`text-center p-3 rounded-lg border ${scoreColor}`}>
            <span className="text-3xl font-bold tabular-nums">{result.score}</span>
            <span className="text-sm ml-1">/100</span>
          </div>

          <p className="text-xs text-muted-foreground">{result.reasoning}</p>

          {result.flaggedPhrases.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Flagged phrases:
              </p>
              <ul className="space-y-1">
                {result.flaggedPhrases.map((phrase, i) => (
                  <li
                    key={i}
                    className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200"
                  >
                    &ldquo;{phrase}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!result && !error && (
        <p className="text-xs text-muted-foreground">
          Click &ldquo;Score Draft&rdquo; to evaluate voice adherence
        </p>
      )}
    </div>
  );
}
