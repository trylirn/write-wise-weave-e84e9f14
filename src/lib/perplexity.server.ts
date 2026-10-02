export type SearchResult = { title: string; url: string; snippet: string; date?: string };

export async function perplexitySearch(queries: string[]): Promise<SearchResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const pplxKey = process.env["PERPLEXITY_API_KEY"];
  if (!lovableKey || !pplxKey) throw new Error("Perplexity research is not configured.");
  const res = await fetch("https://connector-gateway.lovable.dev/perplexity/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": pplxKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: queries.slice(0, 5), max_results: 6 }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 402) throw new Error("Out of credits for web research. Top up to keep searching.");
    throw new Error(`Perplexity search failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { results?: unknown };
  // Multi-query responses may be nested arrays.
  const flat = (Array.isArray(json.results) ? json.results : []).flat(2) as SearchResult[];
  const seen = new Set<string>();
  return flat.filter((r) => r?.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 12);
}
