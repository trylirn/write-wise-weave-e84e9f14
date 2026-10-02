import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, parseJson } from "./ai.server";
import { perplexitySearch } from "./perplexity.server";
import { publishArticle } from "./publish.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function check<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  if (r.data == null) throw new Error("Not found");
  return r.data as NonNullable<T>;
}

export type SiteAnalysis = {
  summary: string;
  niche: string;
  audience: string;
  tone_of_voice: string;
  content_themes: string[];
  writing_guidelines: string[];
};

/* ---------------- Sites ---------------- */
const siteInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  url: z.string().max(500),
  endpoint_url: z.string().max(500),
  api_key: z.string().max(500),
  default_author: z.string().max(120),
  default_category: z.string().max(120),
});

export const listSites = createServerFn({ method: "GET" }).handler(async () => {
  const rows = check(await (await db()).from("sites").select("*").order("created_at"));
  // never send full secrets to the browser
  return rows.map((s) => ({ ...s, api_key: "", has_api_key: !!s.api_key, api_key_hint: s.api_key ? `••••${s.api_key.slice(-4)}` : "" }));
});

export const saveSite = createServerFn({ method: "POST" })
  .inputValidator((d) => siteInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { id, api_key, ...rest } = data;
    const patch = api_key ? { ...rest, api_key } : rest;
    if (id) {
      check(await sb.from("sites").update(patch).eq("id", id));
      return { id };
    }
    const count = check(await sb.from("sites").select("id")).length;
    if (count >= 4) throw new Error("You can manage up to 4 websites.");
    const row = check(await sb.from("sites").insert({ ...rest, api_key }).select("id").single());
    return { id: row.id };
  });

export const deleteSite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(await (await db()).from("sites").delete().eq("id", data.id));
    return { ok: true };
  });

function htmlToText(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const desc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html)?.[1] ?? "";
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `TITLE: ${title}\nDESCRIPTION: ${desc}\nTEXT: ${body}`.slice(0, 14000);
}

export const analyzeSite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), url: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    let pageText = "";
    try {
      const res = await fetch(data.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ArticleDeskBot/1.0)" } });
      pageText = htmlToText(await res.text());
    } catch {
      throw new Error("Couldn't open that website. Check the link and try again.");
    }
    let extra = "";
    if (pageText.length < 600) {
      // JS-rendered sites return little HTML; supplement with web search
      const host = new URL(data.url).hostname;
      const results = await perplexitySearch([`site:${host}`, `${host} about`]).catch(() => []);
      extra = results.map((r) => `- ${r.title}: ${r.snippet}`).join("\n");
    }
    const text = await generateText(
      "You are a senior content strategist. Analyze websites and reply with JSON only.",
      `Analyze this website (${data.url}). Return JSON with keys: summary (2-3 sentences), niche, audience, tone_of_voice, content_themes (array of 4-8 strings), writing_guidelines (array of 5-8 actionable rules for writers matching this brand).\n\nPAGE CONTENT:\n${pageText}\n\nWEB MENTIONS:\n${extra}`,
    );
    const analysis = parseJson<SiteAnalysis>(text);
    if (data.id) {
      check(await (await db()).from("sites").update({ analysis, analyzed_at: new Date().toISOString(), url: data.url }).eq("id", data.id));
    }
    return analysis;
  });

/* ---------------- Agents ---------------- */
const agentInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  persona: z.string().max(4000),
  tone: z.string().max(500),
  writing_style: z.string().max(2000),
  target_length: z.number().int().min(200).max(6000),
  formatting_rules: z.string().max(4000),
  site_id: z.string().uuid().nullable(),
});

export const listAgents = createServerFn({ method: "GET" }).handler(async () =>
  check(await (await db()).from("agents").select("*").order("created_at")),
);

export const saveAgent = createServerFn({ method: "POST" })
  .inputValidator((d) => agentInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { id, ...rest } = data;
    if (id) {
      check(await sb.from("agents").update(rest).eq("id", id));
      return { id };
    }
    const row = check(await sb.from("agents").insert(rest).select("id").single());
    return { id: row.id };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(await (await db()).from("agents").delete().eq("id", data.id));
    return { ok: true };
  });

/* ---------------- Articles ---------------- */
export const listArticles = createServerFn({ method: "GET" }).handler(async () =>
  check(
    await (await db())
      .from("articles")
      .select("id,title,status,scheduled_at,published_at,updated_at,site_id,agent_id,last_error,slug")
      .order("updated_at", { ascending: false })
      .limit(200),
  ),
);

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => check(await (await db()).from("articles").select("*").eq("id", data.id).single()));

type Generated = {
  title: string;
  seo_title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  content_markdown: string;
  cover_image_prompt: string;
  tags: string[];
};

export const generateArticle = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        agent_id: z.string().uuid(),
        topic: z.string().min(3).max(500),
        keywords: z.string().max(500),
        research: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await db();
    const agent = check(await sb.from("agents").select("*").eq("id", data.agent_id).single());
    const site = agent.site_id ? check(await sb.from("sites").select("*").eq("id", agent.site_id).single()) : null;
    const analysis = site?.analysis as SiteAnalysis | null;

    let sources: { title: string; url: string; snippet: string; date?: string }[] = [];
    if (data.research) {
      const kws = data.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      sources = await perplexitySearch([data.topic, ...kws.slice(0, 3).map((k) => `${k} ${new Date().getFullYear()}`)]);
    }

    const system = [
      `You are "${agent.name}", an expert article writer.`,
      agent.persona && `PERSONA: ${agent.persona}`,
      agent.tone && `TONE: ${agent.tone}`,
      agent.writing_style && `WRITING STYLE: ${agent.writing_style}`,
      `TARGET LENGTH: about ${agent.target_length} words in the article body.`,
      agent.formatting_rules && `FORMATTING RULES: ${agent.formatting_rules}`,
      site && `PUBLICATION: ${site.name} (${site.url}).`,
      analysis &&
        `BRAND KNOWLEDGE: niche=${analysis.niche}; audience=${analysis.audience}; tone=${analysis.tone_of_voice}; guidelines: ${analysis.writing_guidelines?.join(" | ")}`,
      "Reply with JSON only.",
    ]
      .filter(Boolean)
      .join("\n");

    const sourceBlock = sources.length
      ? `LIVE WEB RESEARCH (cite inline as markdown links [text](url) where you use a fact, and end with a "## Sources" list):\n${sources
          .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}${s.date ? ` (${s.date})` : ""}\n${s.snippet}`)
          .join("\n\n")}`
      : "No live research supplied; do not invent statistics or sources.";

    const text = await generateText(
      system,
      `Write an SEO-optimized article.\nTOPIC: ${data.topic}\nKEYWORDS: ${data.keywords || "(choose sensible ones)"}\nToday: ${new Date().toDateString()}\n\n${sourceBlock}\n\nReturn JSON with keys: title, seo_title (max 60 chars), slug (kebab-case), meta_description (max 155 chars), excerpt (1-2 sentences), content_markdown (full article in markdown using ## and ### headings, no H1), cover_image_prompt (a vivid prompt for an image generator), tags (array of 3-6 strings).`,
    );
    const g = parseJson<Generated>(text);
    const row = check(
      await sb
        .from("articles")
        .insert({
          agent_id: agent.id,
          site_id: agent.site_id,
          topic: data.topic,
          keywords: data.keywords,
          title: g.title ?? data.topic,
          seo_title: (g.seo_title ?? "").slice(0, 70),
          slug: (g.slug ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
          meta_description: (g.meta_description ?? "").slice(0, 170),
          excerpt: g.excerpt ?? "",
          content_markdown: g.content_markdown ?? "",
          cover_image_prompt: g.cover_image_prompt ?? "",
          tags: Array.isArray(g.tags) ? g.tags.slice(0, 8) : [],
          citations: sources.map(({ title, url }) => ({ title, url })),
        })
        .select("id")
        .single(),
    );
    return { id: row.id };
  });

const articleInput = z.object({
  id: z.string().uuid(),
  title: z.string().max(300),
  seo_title: z.string().max(120),
  slug: z.string().max(200),
  meta_description: z.string().max(300),
  excerpt: z.string().max(1000),
  content_markdown: z.string().max(100000),
  cover_image_prompt: z.string().max(2000),
  tags: z.array(z.string().max(60)).max(12),
  site_id: z.string().uuid().nullable(),
});

export const saveArticle = createServerFn({ method: "POST" })
  .inputValidator((d) => articleInput.parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    check(await (await db()).from("articles").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id));
    return { ok: true };
  });

export const optimizeArticle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), instruction: z.string().max(1000) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const a = check(await sb.from("articles").select("*").eq("id", data.id).single());
    const text = await generateText(
      "You are an SEO editor. Improve articles while keeping facts and citations intact. Reply with JSON only.",
      `Improve this article. ${data.instruction || "Tighten the writing, strengthen headings for SEO, and improve the SEO title and meta description."}\nKeywords: ${a.keywords}\n\nCURRENT JSON:\n${JSON.stringify({ title: a.title, seo_title: a.seo_title, slug: a.slug, meta_description: a.meta_description, excerpt: a.excerpt, content_markdown: a.content_markdown })}\n\nReturn JSON with the same keys.`,
    );
    const g = parseJson<Partial<Generated>>(text);
    check(
      await sb
        .from("articles")
        .update({
          title: g.title ?? a.title,
          seo_title: g.seo_title ?? a.seo_title,
          slug: g.slug ?? a.slug,
          meta_description: g.meta_description ?? a.meta_description,
          excerpt: g.excerpt ?? a.excerpt,
          content_markdown: g.content_markdown ?? a.content_markdown,
          updated_at: new Date().toISOString(),
        })
        .eq("id", a.id),
    );
    return { ok: true };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    check(await (await db()).from("articles").delete().eq("id", data.id));
    return { ok: true };
  });

export const publishNow = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => publishArticle(data.id));

export const scheduleArticle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), scheduled_at: z.string().datetime().nullable() }).parse(d))
  .handler(async ({ data }) => {
    check(
      await (await db())
        .from("articles")
        .update({
          status: data.scheduled_at ? "scheduled" : "draft",
          scheduled_at: data.scheduled_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id),
    );
    return { ok: true };
  });

export const listLogs = createServerFn({ method: "GET" }).handler(async () =>
  check(
    await (await db())
      .from("publish_logs")
      .select("*, articles(title), sites(name)")
      .order("created_at", { ascending: false })
      .limit(200),
  ),
);
