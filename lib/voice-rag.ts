import { querySimilarContent } from "./vector-store";

export async function buildVoiceContext(topic: string): Promise<string> {
  const similar = await querySimilarContent(topic, 5);

  if (similar.length === 0) {
    return "(No voice corpus entries found. The draft will be generated without voice calibration.)";
  }

  return similar.map((e) => e.content).join("\n\n---\n\n");
}
