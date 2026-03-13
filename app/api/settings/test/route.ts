import { NextResponse } from "next/server";
import { requireSetting } from "@/lib/settings";
import { requireAdmin, AuthError } from "@/lib/auth-context";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { key } = await request.json();

    if (key === "ANTHROPIC_API_KEY") {
      const apiKey = await requireSetting("ANTHROPIC_API_KEY");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ ok: false, error: `Anthropic API error: ${err}` });
      }
      return NextResponse.json({ ok: true, message: "Anthropic API key is valid" });
    }

    if (key === "OPENAI_API_KEY") {
      const apiKey = await requireSetting("OPENAI_API_KEY");
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ ok: false, error: `OpenAI API error: ${err}` });
      }
      return NextResponse.json({ ok: true, message: "OpenAI API key is valid" });
    }

    if (key === "EXA_API_KEY") {
      const apiKey = await requireSetting("EXA_API_KEY");
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "test",
          numResults: 1,
          type: "auto",
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ ok: false, error: `Exa API error: ${err}` });
      }
      return NextResponse.json({ ok: true, message: "Exa API key is valid" });
    }

    return NextResponse.json({ error: "Unsupported key for testing" }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Test failed";
    return NextResponse.json({ ok: false, error: message });
  }
}
