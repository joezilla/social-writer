"use client";

import { useState } from "react";

interface Snapshot {
  date: string;
  followers: number;
}

interface PostMarker {
  id: string;
  title: string;
  publishedAt: string;
  topicTags: string;
}

export default function FollowerChart({
  snapshots,
  postMarkers,
}: {
  snapshots: Snapshot[];
  postMarkers: PostMarker[];
}) {
  const [hoveredMarker, setHoveredMarker] = useState<PostMarker | null>(null);

  if (snapshots.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground bg-card">
        No follower data yet. Run the scraper to start collecting snapshots.
      </div>
    );
  }

  // Chart dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Scale calculations
  const followers = snapshots.map((s) => s.followers);
  const minF = Math.min(...followers);
  const maxF = Math.max(...followers);
  const rangeF = maxF - minF || 1;

  const dates = snapshots.map((s) => new Date(s.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const rangeDate = maxDate - minDate || 1;

  function scaleX(timestamp: number) {
    return padding.left + ((timestamp - minDate) / rangeDate) * chartW;
  }

  function scaleY(value: number) {
    return padding.top + chartH - ((value - minF) / rangeF) * chartH;
  }

  // Build line path
  const pathPoints = snapshots.map((s, i) => {
    const x = scaleX(dates[i]);
    const y = scaleY(s.followers);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  });
  const linePath = pathPoints.join(" ");

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minF + (rangeF * i) / (yTicks - 1))
  );

  // X-axis ticks (show ~5 dates)
  const xTicks = Math.min(5, snapshots.length);
  const xTickIndices = Array.from({ length: xTicks }, (_, i) =>
    Math.round((i * (snapshots.length - 1)) / (xTicks - 1))
  );

  return (
    <div className="border rounded-lg p-4 bg-card">
      <h2 className="text-lg font-semibold mb-4 text-foreground">Follower Growth</h2>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[800px]"
          role="img"
          aria-label="Follower growth chart"
        >
          {/* Grid lines */}
          {yTickValues.map((val) => (
            <line
              key={val}
              x1={padding.left}
              y1={scaleY(val)}
              x2={width - padding.right}
              y2={scaleY(val)}
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          ))}

          {/* Y-axis labels */}
          {yTickValues.map((val) => (
            <text
              key={val}
              x={padding.left - 10}
              y={scaleY(val) + 4}
              textAnchor="end"
              className="text-[10px] tabular-nums"
              fill="hsl(var(--muted-foreground))"
            >
              {val.toLocaleString()}
            </text>
          ))}

          {/* X-axis labels */}
          {xTickIndices.map((idx) => (
            <text
              key={idx}
              x={scaleX(dates[idx])}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px]"
              fill="hsl(var(--muted-foreground))"
            >
              {new Date(dates[idx]).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </text>
          ))}

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {snapshots.map((s, i) => (
            <circle
              key={i}
              cx={scaleX(dates[i])}
              cy={scaleY(s.followers)}
              r="3"
              fill="hsl(var(--accent))"
            />
          ))}

          {/* Post markers */}
          {postMarkers.map((marker) => {
            const ts = new Date(marker.publishedAt).getTime();
            if (ts < minDate || ts > maxDate) return null;
            const x = scaleX(ts);
            return (
              <g
                key={marker.id}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
                className="cursor-pointer"
              >
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + chartH}
                  stroke="hsl(var(--warning))"
                  strokeWidth="1"
                  strokeDasharray="4 2"
                />
                <circle
                  cx={x}
                  cy={padding.top}
                  r="5"
                  fill="hsl(var(--warning))"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover tooltip */}
      {hoveredMarker && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p className="font-medium text-foreground">{hoveredMarker.title}</p>
          <p className="text-xs text-muted-foreground">
            Published:{" "}
            {new Date(hoveredMarker.publishedAt).toLocaleDateString()}
          </p>
          {hoveredMarker.topicTags && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Tags: {hoveredMarker.topicTags}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
