const EXA_SEARCH_URL = "https://api.exa.ai/search";

export interface ExaResult {
  title: string;
  url: string;
  excerpt: string;
  publishedDate: string | null;
}

export async function searchExa(query: string, numResults = 5): Promise<ExaResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY is not set");

  const res = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      numResults,
      type: "auto",
      contents: {
        text: { maxCharacters: 1000 },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Exa search failed: ${err}`);
  }

  const data = await res.json();

  return (data.results || []).map(
    (r: { title?: string; url: string; text?: string; publishedDate?: string }) => ({
      title: r.title || "",
      url: r.url,
      excerpt: r.text || "",
      publishedDate: r.publishedDate || null,
    })
  );
}

export async function searchMultipleQueries(
  queries: string[],
  numResultsPerQuery = 3
): Promise<ExaResult[]> {
  const allResults: ExaResult[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    try {
      const results = await searchExa(query, numResultsPerQuery);
      for (const r of results) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          allResults.push(r);
        }
      }
    } catch (err) {
      console.error(`Exa query failed for "${query}":`, err);
    }
  }

  return allResults;
}
