"use client";

import { useState } from "react";

interface FactCheckClaim {
  text: string;
  verdict: "supported" | "unsupported" | "disputed";
  source: string | null;
  sourceUrl: string | null;
  suggestion: string | null;
}

export default function FactCheckPanel({ postId }: { postId: string }) {
  const [claims, setClaims] = useState<FactCheckClaim[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFactCheck() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/fact-check`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fact check failed");
        return;
      }
      setClaims(data.claims);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const verdictStyles = {
    supported: "bg-emerald-50 text-emerald-800 border-emerald-200",
    unsupported: "bg-red-50 text-red-800 border-red-200",
    disputed: "bg-amber-50 text-amber-800 border-amber-200",
  };

  const verdictLabels = {
    supported: "Supported",
    unsupported: "Unsupported",
    disputed: "Disputed",
  };

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Fact Check</h3>
        <button
          onClick={handleFactCheck}
          disabled={loading}
          className="px-3 py-1 text-xs bg-muted rounded-md hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring"
        >
          {loading ? "Checking\u2026" : "Run Fact Check"}
        </button>
      </div>

      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      {claims && (
        <div className="space-y-2">
          {/* Summary counts */}
          <div className="flex gap-2 text-xs mb-2">
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded tabular-nums">
              {claims.filter((c) => c.verdict === "supported").length} supported
            </span>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded tabular-nums">
              {claims.filter((c) => c.verdict === "disputed").length} disputed
            </span>
            <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded tabular-nums">
              {claims.filter((c) => c.verdict === "unsupported").length}{" "}
              unsupported
            </span>
          </div>

          {/* Individual claims */}
          <ul className="space-y-2 max-h-[400px] overflow-y-auto overscroll-contain">
            {claims.map((claim, i) => (
              <li
                key={i}
                className={`text-xs p-2 rounded-lg border ${verdictStyles[claim.verdict]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1">&ldquo;{claim.text}&rdquo;</p>
                  <span className="font-semibold whitespace-nowrap">
                    {verdictLabels[claim.verdict]}
                  </span>
                </div>
                {claim.source && (
                  <p className="mt-1 opacity-80">
                    Source:{" "}
                    {claim.sourceUrl ? (
                      <a
                        href={claim.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline focus-ring rounded-sm"
                      >
                        {claim.source}
                      </a>
                    ) : (
                      claim.source
                    )}
                  </p>
                )}
                {claim.suggestion && (
                  <p className="mt-1 italic opacity-80">{claim.suggestion}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!claims && !error && (
        <p className="text-xs text-muted-foreground">
          Click &ldquo;Run Fact Check&rdquo; to verify claims against research
          sources
        </p>
      )}
    </div>
  );
}
