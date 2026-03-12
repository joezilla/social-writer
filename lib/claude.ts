import Anthropic from "@anthropic-ai/sdk";
import { requireSetting } from "./settings";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
  anthropicKey: string | undefined;
};

async function getClient(): Promise<Anthropic> {
  const apiKey = await requireSetting("ANTHROPIC_API_KEY");

  // Recreate client if the key has changed
  if (globalForAnthropic.anthropic && globalForAnthropic.anthropicKey === apiKey) {
    return globalForAnthropic.anthropic;
  }

  const client = new Anthropic({ apiKey });
  globalForAnthropic.anthropic = client;
  globalForAnthropic.anthropicKey = apiKey;
  return client;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 4096
): Promise<string> {
  const anthropic = await getClient();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = message.content[0];
  if (block.type === "text") return block.text;
  throw new Error("Unexpected response type from Claude");
}

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<T> {
  const text = await generateText(systemPrompt, userPrompt, maxTokens);
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned) as T;
}
