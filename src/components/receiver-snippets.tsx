import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PROMPT = `Add a blog that can receive posts from an external publishing tool.

1. Create a "posts" table with: id (uuid), source_id (text, unique), title, seo_title, slug (unique), meta_description, excerpt, content_html, content_markdown, cover_image_prompt, tags (text[]), citations (jsonb), author, category, published_at (timestamptz), created_at. Anyone can read posts; nobody can write from the browser.
2. Add a secret called BLOG_PUBLISH_KEY (I will paste a value).
3. Create a public POST endpoint at /api/public/posts that:
   - rejects the request with 401 unless the "Authorization: Bearer <key>" header equals BLOG_PUBLISH_KEY (timing-safe compare),
   - validates the JSON body,
   - upserts the post by source_id (so re-publishing updates it), and returns { ok: true, url }.
4. Add a /blog page listing posts newest first and a /blog/$slug page rendering content_html with the seo_title and meta_description in the page head.`;

const SQL = `create table public.posts (
  id uuid primary key default gen_random_uuid(),
  source_id text unique not null,
  title text not null,
  seo_title text, slug text unique not null,
  meta_description text, excerpt text,
  content_html text, content_markdown text,
  cover_image_prompt text, tags text[] default '{}',
  citations jsonb default '[]',
  author text, category text,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);
grant select on public.posts to anon, authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "Public can read posts" on public.posts for select using (true);`;

const ROUTE = `// src/routes/api/public/posts.ts  (TanStack Start Lovable project)
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const Post = z.object({
  source_id: z.string(), title: z.string(), seo_title: z.string().optional(),
  slug: z.string().min(1), meta_description: z.string().optional(),
  excerpt: z.string().optional(), content_html: z.string(),
  content_markdown: z.string().optional(), cover_image_prompt: z.string().optional(),
  tags: z.array(z.string()).optional(), citations: z.array(z.any()).optional(),
  author: z.string().optional(), category: z.string().optional(),
  published_at: z.string().optional(),
});

const hash = (v: string) => createHash("sha256").update(v).digest();

export const Route = createFileRoute("/api/public/posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["BLOG_PUBLISH_KEY"];
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
        if (!key || !token || !timingSafeEqual(hash(token), hash(key))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const parsed = Post.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("posts")
          .upsert(parsed.data, { onConflict: "source_id" });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, url: \`/blog/\${parsed.data.slug}\` });
      },
    },
  },
});`;

const EDGE = `// supabase/functions/receive-post/index.ts  (older Lovable projects with edge functions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const key = Deno.env.get("BLOG_PUBLISH_KEY");
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (req.method !== "POST" || !key || token !== key) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await req.json();
  if (!body?.source_id || !body?.slug || !body?.title) {
    return new Response("Missing fields", { status: 400 });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await sb.from("posts").upsert(body, { onConflict: "source_id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, url: \`/blog/\${body.slug}\` });
});
// Set verify_jwt = false for this function, since auth is the BLOG_PUBLISH_KEY check.`;

const PAYLOAD = `POST <your endpoint>
Authorization: Bearer <secret API key>
x-api-key: <secret API key>
Content-Type: application/json

{
  "source_id": "uuid", "title": "...", "seo_title": "...", "slug": "...",
  "meta_description": "...", "excerpt": "...",
  "content_html": "<h2>...</h2>", "content_markdown": "## ...",
  "cover_image_prompt": "...", "tags": ["..."],
  "citations": [{ "title": "...", "url": "..." }],
  "author": "...", "category": "...", "published_at": "ISO date"
}`;

function Code({ text }: { text: string }) {
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        className="absolute right-2 top-2"
        onClick={() => {
          navigator.clipboard.writeText(text);
          toast.success("Copied");
        }}
      >
        Copy
      </Button>
      <pre className="max-h-96 overflow-auto bg-foreground p-4 pr-20 font-mono text-xs leading-relaxed text-background">{text}</pre>
    </div>
  );
}

export function ReceiverSnippets() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-12 border-t-4 border-double border-foreground pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Set up a website to receive posts</h2>
          <p className="text-sm text-muted-foreground">
            Easiest: paste the prompt into your Lovable website's chat. Then copy its endpoint URL and the key you chose here.
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide instructions" : "Show instructions"}
        </Button>
      </div>
      {open && (
        <Tabs defaultValue="prompt" className="mt-4">
          <TabsList>
            <TabsTrigger value="prompt">Lovable prompt</TabsTrigger>
            <TabsTrigger value="sql">Table SQL</TabsTrigger>
            <TabsTrigger value="route">Endpoint (TanStack)</TabsTrigger>
            <TabsTrigger value="edge">Edge function</TabsTrigger>
            <TabsTrigger value="payload">Payload format</TabsTrigger>
          </TabsList>
          <TabsContent value="prompt">
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">
              <li>Open your website project in Lovable and paste the prompt below.</li>
              <li>When it asks for BLOG_PUBLISH_KEY, paste a long random value (e.g. from a password manager).</li>
              <li>Publish that website, then add it here with endpoint <code>https://your-site.lovable.app/api/public/posts</code> and the same key.</li>
            </ol>
            <Code text={PROMPT} />
          </TabsContent>
          <TabsContent value="sql"><Code text={SQL} /></TabsContent>
          <TabsContent value="route"><Code text={ROUTE} /></TabsContent>
          <TabsContent value="edge"><Code text={EDGE} /></TabsContent>
          <TabsContent value="payload"><Code text={PAYLOAD} /></TabsContent>
        </Tabs>
      )}
    </section>
  );
}
