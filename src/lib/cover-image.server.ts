// Cover illustrations — only for agents whose name contains "intearior".
// Never throws: if image credits run out, the article continues without an image.
const STYLE =
  "Contemporary editorial lifestyle illustration, flat textured vector / digital gouache with subtle matte grain, clean architectural line work. Warm earth palette: sage and olive green, terracotta, burnt orange, rust, warm beige, linen, soft cream, natural oak. Interior design subject matter such as curated rooms, mood boards with fabric swatches and paint fans, material samples, floor plan sketches, plants, cozy Japandi/Scandinavian styling. Wide 16:9 landscape banner composition. No photorealism, no text, no letters, no logos, no watermark.";

export function wantsCoverImage(agentName: string) {
  return agentName.toLowerCase().includes("intearior");
}

export async function makeCoverImage(articleId: string, subject: string): Promise<string | null> {
  try {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-image-2.5-sunburst",
        prompt: `${STYLE}\n\nScene for this article: ${subject}`,
        size: "1536x1024",
        quality: "medium",
      }),
    });
    if (!res.ok) throw new Error(`[${res.status}] ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${articleId}.png`;
    const up = await supabaseAdmin.storage.from("article-images").upload(path, bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(up.error.message);
    // Bucket is private (public buckets blocked); a 10-year link works like a public URL.
    const { data, error } = await supabaseAdmin.storage.from("article-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (error || !data) throw new Error(error?.message ?? "No link");
    await supabaseAdmin.from("articles").update({ cover_image_url: data.signedUrl }).eq("id", articleId);
    return data.signedUrl;
  } catch (e) {
    console.error("Cover image skipped:", e instanceof Error ? e.message : e);
    return null;
  }
}
