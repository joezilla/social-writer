"use client";

import { useEffect, useState } from "react";

interface LinkedInStatus {
  connected: boolean;
  expired?: boolean;
  displayName?: string;
  expiresAt?: string;
}

export default function LinkedInConnect() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/linkedin/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/linkedin/auth", { method: "POST" });
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await fetch("/api/linkedin/status", { method: "DELETE" });
    setStatus({ connected: false });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Checking connection\u2026</div>;
  }

  if (status?.connected) {
    return (
      <div className="border rounded-lg p-4 bg-emerald-50 border-emerald-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-emerald-800">Connected</p>
            <p className="text-sm text-emerald-700">{status.displayName}</p>
            {status.expiresAt && (
              <p className="text-xs text-emerald-600 mt-1">
                Expires: {new Date(status.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors focus-ring"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (status?.expired) {
    return (
      <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
        <p className="font-medium text-amber-800 mb-2">Token Expired</p>
        <p className="text-sm text-amber-700 mb-3">
          Your LinkedIn connection has expired. Please reconnect.
        </p>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-ring"
        >
          {connecting ? "Redirecting\u2026" : "Reconnect LinkedIn"}
        </button>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-card">
      <p className="text-sm text-muted-foreground mb-3">
        Connect your LinkedIn account to publish posts directly.
      </p>
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-ring"
      >
        {connecting ? "Redirecting\u2026" : "Connect LinkedIn"}
      </button>
    </div>
  );
}
