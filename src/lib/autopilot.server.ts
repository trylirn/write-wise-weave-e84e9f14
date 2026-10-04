import { generateText, parseJson } from "./ai.server";
import { perplexitySearch, type SearchResult } from "./perplexity.server";
import { publishArticle } from "./publish.server";

type Analysis = { niche?: string; audience?: string; tone_of_voice?: string; content_themes?: string[]; writing_guidelines?: string[] } | null;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Gen = {
  title: string; seo_title: string; slug: string; meta_description: string; excerpt: string;
  content_markdown: string; cover_image_prompt: string; tags: string[];
};
export type SeoItem = { rule: string; passed: boolean; note: string };

const GOOGLE_RULES = `Google Search SEO starter guide checks:
1. Helpful, reliable, people-first content written for the audience, not search engines.
2. Unique, accurate, descriptive title (seo_title <= 60 chars).
3. Meta description summarizes the page clearly (<= 155 chars).
4. Clear structure with descriptive ## / ### headings; easy to read, short paragraphs.
5. Descriptive, readable slug made of meaningful words.
6. Keywords used naturally; no keyword stuffing.
7. Facts are supported by cited sources; no invented statistics.
8. Original content that adds value, up to date, no filler or duplication.
9. Links use descriptive anchor text.`;

export async function discoverTopic(agentId: string) {
  const sb = await db();
  const { data: agent } = await sb.from("agents").select("*").eq("id", agentId).single();
  if (!agent) throw new Error("Agent not found");
  const { data: site } = agent.site_id ? await sb.from("sites").select("*").eq("id", agent.site_id).single() : { data: null };
  const a = site?.analysis as Analysis;
  const niche = a?.niche || site?.name || agent.persona.slice(0, 80) || agent.name;
  const themes = (a?.content_themes ?? []).slice(0, 3);
  const year = new Date().getFullYear();
  const research = await perplexitySearch([
    `${niche} trending questions ${year}`,
    `${niche} latest news`,
    ...themes.map((t) => `${t} ${year}`),
  ].slice(0, 5));
  const { data: past } = await sb.from("articles").select("title").eq(agent.site_id ? "site_id" : "agent_id", agent.site_id ?? agent.id).order("created_at", { ascending: false }).limit(40);
  const text = await generateText(
    "You are an SEO content strategist. Reply with JSON only.",
    `Choose ONE fresh article topic for this publication.\nNiche: ${niche}\nAudience: ${a?.audience ?? "general"}\nThemes: ${(a?.content_themes ?? []).join(", ")}\nAgent persona: ${agent.persona}\n\nLIVE RESEARCH:\n${research.map((r) => `- ${r.title}: ${r.snippet}`).join("\n")}\n\nALREADY COVERED (avoid similar topics):\n${(past ?? []).map((p) => `- ${p.title}`).join("\n") || "(none)"}\n\nPick a topic people are actively searching for now, with real search intent. Return JSON {"topic": string, "keywords": [3-6 strings, primary first]}.`,
  );
  const g = parseJson<{ topic: string; keywords: string[] }>(text);
  return { topic: g.topic, keywords: (g.keywords ?? []).slice(0, 6).join(", "), research };
}

export async function writeArticle(opts: { agent_id: string; topic: string; keywords: string; research: boolean; sources?: SearchResult[]; auto?: boolean }) {
  const sb = await db();
  const { data: agent } = await sb.from("agents").select("*").eq("id", opts.agent_id).single();
  if (!agent) throw new Error("Agent not found");
  const { data: site } = agent.site_id ? await sb.from("sites").select("*").eq("id", agent.site_id).single() : { data: null };
  const analysis = site?.analysis as Analysis;

  let sources = opts.sources ?? [];
  if (opts.research) {
    const kws = opts.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    const fresh = await perplexitySearch([opts.topic, ...kws.slice(0, 3).map((k) => `${k} ${new Date().getFullYear()}`)]);
    const seen = new Set(fresh.map((s) => s.url));
    sources = [...fresh, ...sources.filter((s) => !seen.has(s.url))].slice(0, 12);
  }
  const system = [
    `You are "${agent.name}", an expert article writer.`,
    agent.persona && `PERSONA: ${agent.persona}`,
    agent.tone && `TONE: ${agent.tone}`,
    agent.writing_style && `WRITING STYLE: ${agent.writing_style}`,
    `TARGET LENGTH: about ${agent.target_length} words in the article body.`,
    agent.formatting_rules && `FORMATTING RULES: ${agent.formatting_rules}`,
    site && `PUBLICATION: ${site.name} (${site.url}).`,
    analysis && `BRAND KNOWLEDGE: niche=${analysis.niche}; audience=${analysis.audience}; tone=${analysis.tone_of_voice}; guidelines: ${analysis.writing_guidelines?.join(" | ")}`,
    `Follow these rules:\n${GOOGLE_RULES}`,
    "Reply with JSON only.",
  ].filter(Boolean).join("\n");
  const sourceBlock = sources.length
    ? `LIVE WEB RESEARCH (cite inline as markdown links [text](url) where you use a fact, and end with a "## Sources" list):\n${sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}${s.date ? ` (${s.date})` : ""}\n${s.snippet}`).join("\n\n")}`
    : "No live research supplied; do not invent statistics or sources.";
  const text = await generateText(
    system,
    `Write an SEO-optimized article.\nTOPIC: ${opts.topic}\nKEYWORDS: ${opts.keywords || "(choose sensible ones)"}\nToday: ${new Date().toDateString()}\n\n${sourceBlock}\n\nReturn JSON with keys: title, seo_title (max 60 chars), slug (kebab-case), meta_description (max 155 chars), excerpt (1-2 sentences), content_markdown (full article in markdown using ## and ### headings, no H1), cover_image_prompt (a vivid prompt for an image generator), tags (array of 3-6 strings).`,
  );
  const g = parseJson<Gen>(text);
  const { data: row, error } = await sb.from("articles").insert({
    agent_id: agent.id, site_id: agent.site_id, topic: opts.topic, keywords: opts.keywords,
    ...clean(g, opts.topic),
    citations: sources.map(({ title, url }) => ({ title, url })),
    auto_generated: !!opts.auto,
  }).select("id").single();
  if (error || !row) throw new Error(error?.message ?? "Could not save article");
  return { id: row.id as string };
}

function clean(g: Partial<Gen>, fallbackTitle: string) {
  return {
    title: g.title || fallbackTitle,
    seo_title: (g.seo_title ?? "").slice(0, 70),
    slug: (g.slug ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
    meta_description: (g.meta_description ?? "").slice(0, 170),
    excerpt: g.excerpt ?? "",
    content_markdown: g.content_markdown ?? "",
    cover_image_prompt: g.cover_image_prompt ?? "",
    tags: Array.isArray(g.tags) ? g.tags.slice(0, 8) : [],
  };
}

/** Scores against Google's guide; revises once if needed. Saves score + report. */
export async function reviewAndFix(articleId: string) {
  const sb = await db();
  const load = async () => {
    const { data } = await sb.from("articles").select("*").eq("id", articleId).single();
    if (!data) throw new Error("Article not found");
    return data;
  };
  const review = async (a: Awaited<ReturnType<typeof load>>) => {
    const t = await generateText(
      "You are a strict Google Search quality reviewer. Reply with JSON only.",
      `${GOOGLE_RULES}\n\nReview this article against each rule. Keywords: ${a.keywords}\nARTICLE JSON:\n${JSON.stringify({ title: a.title, seo_title: a.seo_title, slug: a.slug, meta_description: a.meta_description, content_markdown: a.content_markdown })}\n\nReturn JSON {"score": 0-100, "items": [{"rule": short name, "passed": boolean, "note": one sentence}]}.`,
    );
    return parseJson<{ score: number; items: SeoItem[] }>(t);
  };
  let a = await load();
  let r = await review(a);
  const failed = (r.items ?? []).filter((i) => !i.passed);
  if (failed.length || r.score < 85) {
    const t = await generateText(
      "You are an SEO editor. Fix issues while keeping facts, voice and citations intact. Reply with JSON only.",
      `Fix these Google guideline issues:\n${failed.map((i) => `- ${i.rule}: ${i.note}`).join("\n") || "- raise overall quality"}\n\nCURRENT JSON:\n${JSON.stringify({ title: a.title, seo_title: a.seo_title, slug: a.slug, meta_description: a.meta_description, excerpt: a.excerpt, content_markdown: a.content_markdown })}\n\nReturn JSON with the same keys.`,
    );
    const g = parseJson<Partial<Gen>>(t);
    const c = clean({ ...a, ...g, tags: a.tags }, a.title);
    await sb.from("articles").update({ ...c, updated_at: new Date().toISOString() }).eq("id", a.id);
    a = await load();
    const fixedRules = new Set(failed.map((i) => i.rule));
    r = await review(a);
    r.items = (r.items ?? []).map((i) => (i.passed && fixedRules.has(i.rule) ? { ...i, note: `Fixed: ${i.note}` } : i));
  }
  await sb.from("articles").update({ seo_score: Math.round(r.score ?? 0), seo_report: r.items ?? [] }).eq("id", a.id);
  return r;
}

export async function runAgent(agentId: string) {
  const { topic, keywords, research } = await discoverTopic(agentId);
  const { id } = await writeArticle({ agent_id: agentId, topic, keywords, research: true, sources: research, auto: true });
  await reviewAndFix(id);
  const result = await publishArticle(id);
  return { id, topic, ...result };
}

/** Runs at most one due autopilot agent, guarded by a DB lease. */
export async function runDueAutopilot() {
  const sb = await db();
  const now = new Date();
  const { data: lease } = await sb.from("autopilot_lock").update({ locked_until: new Date(now.getTime() + 10 * 60_000).toISOString() })
    .eq("id", 1).lt("locked_until", now.toISOString()).select("id");
  if (!lease?.length) return { skipped: "locked" };
  try {
    const { data: due } = await sb.from("agents").select("id,articles_per_day,next_run_at")
      .eq("autopilot", true).or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)
      .order("next_run_at", { ascending: true, nullsFirst: true }).limit(1);
    const agent = due?.[0];
    if (!agent) return { skipped: "nothing due" };
    const interval = (24 * 3600_000) / Math.max(1, agent.articles_per_day);
    await sb.from("agents").update({ next_run_at: new Date(now.getTime() + interval).toISOString(), last_run_at: now.toISOString() }).eq("id", agent.id);
    try {
      const r = await runAgent(agent.id);
      await sb.from("agents").update({ last_error: r.ok ? null : r.message }).eq("id", agent.id);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const pause = /credits|\[40[23]\]/i.test(msg);
      await sb.from("agents").update({ last_error: msg, ...(pause ? { autopilot: false } : {}) }).eq("id", agent.id);
      return { error: msg, paused: pause };
    }
  } finally {
    await sb.from("autopilot_lock").update({ locked_until: new Date(0).toISOString() }).eq("id", 1);
  }
}
