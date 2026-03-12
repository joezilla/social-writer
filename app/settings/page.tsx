import LinkedInConnect from "@/components/settings/LinkedInConnect";
import SettingsForm from "@/components/settings/SettingsForm";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-8 text-balance">Settings</h1>

      <SettingsForm />

      <section className="mt-8 mb-8">
        <h2 className="text-lg font-semibold mb-4">LinkedIn Connection</h2>
        <LinkedInConnect />
      </section>
    </div>
  );
}
