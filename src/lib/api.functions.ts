import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, parseJson } from "./ai.server";
import { perplexitySearch } from "./perplexity.server";
import { publishArticle } from "./publish.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
function ok(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}
function check<R extends { data: unknown; error: { message: string } | null }>(r: R): NonNullable<R["data"]> {
  if (r.error) throw new Error(r.error.message);
  if (r.data == null) throw new Error("Not found");
  return r.data as NonNullable<R["data"]>;
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
      ok(await sb.from("sites").update(patch).eq("id", id));
      return { id };
    }
    const row = check(await sb.from("sites").insert({ ...rest, api_key }).select("id").single());
    return { id: row.id };
  });

export const deleteSite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    ok(await (await db()).from("sites").delete().eq("id", data.id));
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
      ok(await (await db()).from("sites").update({ analysis, analyzed_at: new Date().toISOString(), url: data.url }).eq("id", data.id));
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
  autopilot: z.boolean().default(false),
  articles_per_day: z.number().int().min(1).max(24).default(1),
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
      const prev = check(await sb.from("agents").select("autopilot").eq("id", id).single());
      const patch = rest.autopilot && !prev.autopilot ? { ...rest, next_run_at: new Date().toISOString(), last_error: null } : rest;
      ok(await sb.from("agents").update(patch).eq("id", id));
      return { id };
    }
    const row = check(await sb.from("agents").insert({ ...rest, next_run_at: rest.autopilot ? new Date().toISOString() : null }).select("id").single());
    return { id: row.id };
  });

export const setAgentRunning = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), running: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const patch = data.running
      ? { autopilot: true, next_run_at: new Date().toISOString(), last_error: null }
      : { autopilot: false };
    ok(await (await db()).from("agents").update(patch).eq("id", data.id));
    return { ok: true };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    ok(await (await db()).from("agents").delete().eq("id", data.id));
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
    z.object({ agent_id: z.string().uuid(), topic: z.string().min(3).max(500), keywords: z.string().max(500), research: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { writeArticle } = await import("./autopilot.server");
    return writeArticle(data);
  });

export const autopilotStatus = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const agents = check(await sb.from("agents").select("id,name,site_id,autopilot,articles_per_day,next_run_at,last_run_at,last_error").order("created_at"));
  const articles = check(
    await sb.from("articles").select("id,title,keywords,status,seo_score,agent_id,created_at,auto_generated").eq("auto_generated", true).order("created_at", { ascending: false }).limit(30),
  );
  return { agents, articles };
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
    ok(await (await db()).from("articles").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id));
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
    ok(
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
    ok(await (await db()).from("articles").delete().eq("id", data.id));
    return { ok: true };
  });

export const publishNow = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => publishArticle(data.id));

export const scheduleArticle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), scheduled_at: z.string().datetime().nullable() }).parse(d))
  .handler(async ({ data }) => {
    ok(
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
