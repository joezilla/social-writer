"use client";

import { useState } from "react";
import Link from "next/link";

interface KeyClaim {
  claim: string;
  source: string;
  url: string;
}

interface Source {
  title: string;
  url: string;
  excerpt: string;
}

interface BriefData {
  id: string;
  topic: string;
  summary: string;
  keyClaims: KeyClaim[];
  sources: Source[];
  counterarguments?: string[];
  recommendedAngle?: string;
}

export default function ResearchBriefPanel({
  postId,
  initialBrief,
}: {
  postId: string;
  initialBrief: BriefData | null;
}) {
  const [brief, setBrief] = useState<BriefData | null>(initialBrief);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "summary"
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Research generation failed");
        return;
      }
      setBrief(data);
      setExpandedSection("summary");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">Research Brief</h3>
        {brief && (
          <Link
            href={`/posts/${postId}/research`}
            className="text-xs text-accent hover:text-accent/80 transition-colors focus-ring rounded-sm"
          >
            Full view
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-destructive mb-2">{error}</p>}

      {!brief ? (
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            No research brief linked. Generate one to inform your writing.
          </p>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-colors focus-ring"
          >
            {loading ? "Researching\u2026" : "Generate Research Brief"}
          </button>
          {loading && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Generating queries, searching, and synthesizing\u2026
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Summary */}
          <div>
            <button
              onClick={() => toggleSection("summary")}
              className="w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-between py-1 focus-ring rounded-sm transition-colors hover:text-foreground"
              aria-expanded={expandedSection === "summary"}
            >
              Summary
              <span aria-hidden="true">{expandedSection === "summary" ? "\u2212" : "+"}</span>
            </button>
            {expandedSection === "summary" && (
              <p className="text-sm text-foreground/80 mt-1">{brief.summary}</p>
            )}
          </div>

          {/* Key Claims */}
          <div>
            <button
              onClick={() => toggleSection("claims")}
              className="w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-between py-1 focus-ring rounded-sm transition-colors hover:text-foreground"
              aria-expanded={expandedSection === "claims"}
            >
              Key Claims ({brief.keyClaims.length})
              <span aria-hidden="true">{expandedSection === "claims" ? "\u2212" : "+"}</span>
            </button>
            {expandedSection === "claims" && (
              <ul className="mt-1 space-y-1.5">
                {brief.keyClaims.map((claim, i) => (
                  <li key={i} className="text-xs text-foreground/80">
                    <p>{claim.claim}</p>
                    {claim.source && (
                      <a
                        href={claim.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent/80 transition-colors focus-ring rounded-sm"
                      >
                        \u2014 {claim.source}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sources */}
          <div>
            <button
              onClick={() => toggleSection("sources")}
              className="w-full text-left text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center justify-between py-1 focus-ring rounded-sm transition-colors hover:text-foreground"
              aria-expanded={expandedSection === "sources"}
            >
              Sources ({brief.sources.length})
              <span aria-hidden="true">{expandedSection === "sources" ? "\u2212" : "+"}</span>
            </button>
            {expandedSection === "sources" && (
              <ul className="mt-1 space-y-1.5">
                {brief.sources.map((source, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent/80 font-medium transition-colors focus-ring rounded-sm"
                    >
                      {source.title || source.url}
                    </a>
                    {source.excerpt && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2">
                        {source.excerpt}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Regenerate */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full mt-2 px-3 py-1.5 text-xs border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-ring"
          >
            {loading ? "Regenerating\u2026" : "Regenerate Brief"}
          </button>
        </div>
      )}
    </div>
  );
}
