export type SearchResult = { title: string; url: string; snippet: string; date?: string };

function tidy(json: { results?: unknown }): SearchResult[] {
  // Multi-query responses may be nested arrays.
  const flat = (Array.isArray(json.results) ? json.results : []).flat(2) as SearchResult[];
  const seen = new Set<string>();
  return flat.filter((r) => r?.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 12);
}

async function ownKeySearch(queries: string[], key: string): Promise<SearchResult[]> {
  const res = await fetch("https://api.perplexity.ai/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: queries.slice(0, 5), max_results: 6 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Perplexity (own key) search failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return tidy(await res.json());
}

export async function perplexitySearch(queries: string[]): Promise<SearchResult[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const pplxKey = process.env["PERPLEXITY_API_KEY"];
  const ownKey = process.env["PPLX_API_KEY"];
  if (!lovableKey || !pplxKey) {
    if (ownKey) return ownKeySearch(queries, ownKey);
    throw new Error("Perplexity research is not configured.");
  }
  let failure: Error;
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/perplexity/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": pplxKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: queries.slice(0, 5), max_results: 6 }),
    });
    if (res.ok) return tidy(await res.json());
    const body = await res.text();
    failure = new Error(
      res.status === 402
        ? "Out of credits for web research. Top up to keep searching."
        : `Perplexity search failed [${res.status}]: ${body.slice(0, 300)}`,
    );
  } catch (e) {
    failure = e instanceof Error ? e : new Error(String(e));
  }
  // Backup: the owner's own Perplexity key.
  if (ownKey) {
    console.warn("Built-in Perplexity failed, using own key:", failure.message);
    return ownKeySearch(queries, ownKey);
  }
  throw failure;
}
