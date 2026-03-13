"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Setting {
  key: string;
  hasValue: boolean;
  source: string;
  group: string;
  description: string;
  sensitive: boolean;
  value?: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ key: string; ok: boolean; message: string } | null>(null);

  async function loadSettings() {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    setSettings(data.settings || []);
    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave(key: string) {
    await fetch(`/api/settings/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: editValue }),
    });
    setEditKey(null);
    setEditValue("");
    loadSettings();
  }

  async function handleTest(key: string) {
    setTesting(key);
    setTestResult(null);
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    setTestResult({ key, ok: data.ok, message: data.message || data.error });
    setTesting(null);
  }

  const groups = Array.from(new Set(settings.map((s) => s.group)));

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Global Settings</h1>
        <Link
          href="/admin"
          className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
        >
          Back to Users
        </Link>
      </div>

      {groups.map((group) => (
        <div key={group} className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {group.replace("_", " ")}
          </h2>
          {settings
            .filter((s) => s.group === group)
            .map((setting) => (
              <div key={setting.key} className="p-3 rounded-md border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{setting.key}</p>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {setting.hasValue ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                        {setting.source}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                        not set
                      </span>
                    )}
                    {["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "EXA_API_KEY"].includes(setting.key) && setting.hasValue && (
                      <button
                        onClick={() => handleTest(setting.key)}
                        disabled={testing === setting.key}
                        className="text-xs px-2 py-0.5 rounded border hover:bg-muted"
                      >
                        {testing === setting.key ? "Testing..." : "Test"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditKey(setting.key);
                        setEditValue(setting.value || "");
                      }}
                      className="text-xs px-2 py-0.5 rounded border hover:bg-muted"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                {testResult && testResult.key === setting.key && (
                  <p className={`text-xs ${testResult.ok ? "text-success" : "text-destructive"}`}>
                    {testResult.message}
                  </p>
                )}
                {editKey === setting.key && (
                  <div className="flex gap-2">
                    <input
                      type={setting.sensitive ? "password" : "text"}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm rounded-md border bg-background"
                      placeholder={`Enter ${setting.key}`}
                    />
                    <button
                      onClick={() => handleSave(setting.key)}
                      className="px-3 py-1.5 text-sm rounded-md bg-foreground text-background"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditKey(null)}
                      className="px-3 py-1.5 text-sm rounded-md border"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
