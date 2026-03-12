"use client";

import { useEffect, useState, useCallback } from "react";

interface SettingInfo {
  key: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  group: string;
  description: string;
  sensitive: boolean;
  value?: string;
}

interface GroupConfig {
  label: string;
  keys: string[];
}

const GROUPS: Record<string, GroupConfig> = {
  api_keys: {
    label: "API Keys",
    keys: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "EXA_API_KEY"],
  },
  linkedin: {
    label: "LinkedIn Configuration",
    keys: [
      "LINKEDIN_CLIENT_ID",
      "LINKEDIN_CLIENT_SECRET",
      "LINKEDIN_REDIRECT_URI",
      "LINKEDIN_PROFILE_HANDLE",
    ],
  },
  scraper: {
    label: "Scraper Configuration",
    keys: ["SCRAPER_CRON"],
  },
};

const TESTABLE_KEYS = new Set(["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "EXA_API_KEY"]);

export default function SettingsForm() {
  const [settings, setSettings] = useState<SettingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data.settings);
      // Initialize drafts with non-sensitive values
      const initial: Record<string, string> = {};
      for (const s of data.settings) {
        if (s.value !== undefined) {
          initial[s.key] = s.value;
        }
      }
      setDrafts(initial);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(key: string) {
    const value = drafts[key];
    if (!value?.trim()) return;

    setSaving((p) => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.trim() }),
      });
      if (res.ok) {
        await fetchSettings();
        setTestResults((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleTest(key: string) {
    setTesting((p) => ({ ...p, [key]: true }));
    setTestResults((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      setTestResults((p) => ({
        ...p,
        [key]: { ok: data.ok, message: data.message || data.error },
      }));
    } catch {
      setTestResults((p) => ({
        ...p,
        [key]: { ok: false, message: "Test request failed" },
      }));
    } finally {
      setTesting((p) => ({ ...p, [key]: false }));
    }
  }

  async function handleRevert(key: string) {
    try {
      const res = await fetch(`/api/settings/${key}`, { method: "DELETE" });
      if (res.ok) {
        setDrafts((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
        setTestResults((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
        await fetchSettings();
      }
    } catch {
      // ignore
    }
  }

  function getSettingByKey(key: string): SettingInfo | undefined {
    return settings.find((s) => s.key === key);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      {Object.entries(GROUPS).map(([groupKey, group]) => (
        <section key={groupKey}>
          <h2 className="text-lg font-semibold mb-4">{group.label}</h2>
          <div className="space-y-4">
            {group.keys.map((key) => {
              const setting = getSettingByKey(key);
              if (!setting) return null;

              const isTestable = TESTABLE_KEYS.has(key);
              const testResult = testResults[key];

              return (
                <div key={key} className="border rounded-lg p-4 bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium font-mono">
                      {key}
                    </label>
                    {setting.source === "db" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                        Saved
                      </span>
                    )}
                    {setting.source === "env" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        From .env
                      </span>
                    )}
                    {setting.source === "none" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        Not set
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {setting.description}
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={setting.sensitive && !visible[key] ? "password" : "text"}
                        value={drafts[key] ?? ""}
                        onChange={(e) =>
                          setDrafts((p) => ({ ...p, [key]: e.target.value }))
                        }
                        placeholder={
                          setting.hasValue && setting.sensitive
                            ? "********"
                            : "Not configured"
                        }
                        className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background font-mono focus-ring"
                      />
                      {setting.sensitive && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisible((p) => ({ ...p, [key]: !p[key] }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {visible[key] ? "Hide" : "Show"}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleSave(key)}
                      disabled={saving[key] || !drafts[key]?.trim()}
                      className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-ring"
                    >
                      {saving[key] ? "Saving..." : "Save"}
                    </button>
                    {isTestable && setting.hasValue && (
                      <button
                        onClick={() => handleTest(key)}
                        disabled={testing[key]}
                        className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-ring"
                      >
                        {testing[key] ? "Testing..." : "Test"}
                      </button>
                    )}
                  </div>
                  {setting.source === "db" && (
                    <button
                      onClick={() => handleRevert(key)}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Revert to .env
                    </button>
                  )}
                  {testResult && (
                    <p
                      className={`mt-2 text-xs ${
                        testResult.ok ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {testResult.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
