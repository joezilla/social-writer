import LinkedInConnect from "@/components/settings/LinkedInConnect";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-8 text-balance">Settings</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">LinkedIn Connection</h2>
        <LinkedInConnect />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        <p className="text-sm text-muted-foreground">
          Configure API keys in your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> file.
        </p>
      </section>
    </div>
  );
}
