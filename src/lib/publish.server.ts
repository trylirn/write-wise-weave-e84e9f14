import { marked } from "marked";

/** Sends one article to its site's webhook and records the outcome. */
export async function publishArticle(articleId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: a, error } = await supabaseAdmin.from("articles").select("*").eq("id", articleId).single();
  if (error || !a) throw new Error("Article not found");
  const fail = async (message: string, httpStatus?: number) => {
    await supabaseAdmin.from("articles").update({ status: "failed", last_error: message, updated_at: new Date().toISOString() }).eq("id", a.id);
    await supabaseAdmin.from("publish_logs").insert({ article_id: a.id, site_id: a.site_id, success: false, http_status: httpStatus ?? null, message });
    return { ok: false as const, message };
  };
  if (!a.site_id) return fail("No target website assigned");
  const { data: site } = await supabaseAdmin.from("sites").select("*").eq("id", a.site_id).single();
  if (!site?.endpoint_url) return fail("Target website has no publishing endpoint");

  const payload = {
    title: a.title,
    seo_title: a.seo_title,
    slug: a.slug,
    meta_description: a.meta_description,
    excerpt: a.excerpt,
    content_markdown: a.content_markdown,
    content_html: await marked.parse(a.content_markdown),
    cover_image_prompt: a.cover_image_prompt,
    cover_image_url: a.cover_image_url ?? null,
    tags: a.tags,
    citations: a.citations,
    author: site.default_author,
    category: site.default_category,
    published_at: new Date().toISOString(),
    source_id: a.id,
  };
  try {
    const res = await fetch(site.endpoint_url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${site.api_key}`, "x-api-key": site.api_key },
      body: JSON.stringify(payload),
    });
    const body = (await res.text()).slice(0, 500);
    if (!res.ok) return fail(`Website responded ${res.status}: ${body}`, res.status);
    const now = new Date().toISOString();
    await supabaseAdmin.from("articles").update({ status: "published", published_at: now, last_error: null, updated_at: now }).eq("id", a.id);
    await supabaseAdmin.from("publish_logs").insert({ article_id: a.id, site_id: site.id, success: true, http_status: res.status, message: body || "Published" });
    return { ok: true as const, message: "Published" };
  } catch (e) {
    return fail(`Could not reach website: ${e instanceof Error ? e.message : String(e)}`);
  }
}
