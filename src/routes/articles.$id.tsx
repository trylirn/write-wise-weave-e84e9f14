import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { toast } from "sonner";
import {
  getArticle,
  saveArticle,
  optimizeArticle,
  publishNow,
  scheduleArticle,
  deleteArticle,
  listSites,
} from "@/lib/api.functions";
import { StatusBadge, errMsg } from "@/components/desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/articles/$id")({
  head: () => ({
    meta: [
      { title: "Edit article — The Desk" },
      { name: "description", content: "Preview, edit, optimize, schedule and publish an AI-written article." },
      { property: "og:title", content: "Edit article — The Desk" },
      { property: "og:description", content: "Preview, edit, optimize, schedule and publish an article." },
    ],
  }),
  component: ArticlePage,
});

type Form = {
  title: string;
  seo_title: string;
  slug: string;
  meta_description: string;
  excerpt: string;
  content_markdown: string;
  cover_image_prompt: string;
  tags: string;
  site_id: string | null;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ArticlePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchArticle = useServerFn(getArticle);
  const article = useQuery({ queryKey: ["article", id], queryFn: () => fetchArticle({ data: { id } }) });
  const sites = useQuery({ queryKey: ["sites"], queryFn: useServerFn(listSites) });
  const save = useServerFn(saveArticle);
  const optimize = useServerFn(optimizeArticle);
  const publish = useServerFn(publishNow);
  const schedule = useServerFn(scheduleArticle);
  const remove = useServerFn(deleteArticle);

  const [f, setF] = useState<Form | null>(null);
  const [when, setWhen] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const a = article.data;

  useEffect(() => {
    if (!a) return;
    setF({
      title: a.title,
      seo_title: a.seo_title,
      slug: a.slug,
      meta_description: a.meta_description,
      excerpt: a.excerpt,
      content_markdown: a.content_markdown,
      cover_image_prompt: a.cover_image_prompt,
      tags: (a.tags ?? []).join(", "),
      site_id: a.site_id,
    });
    setWhen(toLocalInput(a.scheduled_at));
  }, [a]);

  const html = useMemo(() => (f ? (marked.parse(f.content_markdown) as string) : ""), [f?.content_markdown]);
  const words = f ? f.content_markdown.split(/\s+/).filter(Boolean).length : 0;

  if (!a || !f) return <p className="text-muted-foreground">Loading article…</p>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["article", id] });
    qc.invalidateQueries({ queryKey: ["articles"] });
    qc.invalidateQueries({ queryKey: ["logs"] });
  };
  const persist = () =>
    save({
      data: {
        id,
        ...f,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      },
    });
  const act = async (label: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(label);
    try {
      await fn();
      if (ok) toast.success(ok);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-foreground pb-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Front page</Link>
          <StatusBadge status={a.status} />
          {a.status === "scheduled" && a.scheduled_at && (
            <span className="text-sm text-muted-foreground">Goes live {new Date(a.scheduled_at).toLocaleString()}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => act("save", persist, "Saved")}>
            {busy === "save" ? "Saving…" : "Save"}
          </Button>
          <Button
            disabled={!!busy}
            onClick={() =>
              act("publish", async () => {
                await persist();
                const r = await publish({ data: { id } });
                if (!r.ok) throw new Error(r.message);
              }, "Published to website")
            }
          >
            {busy === "publish" ? "Publishing…" : "Publish now"}
          </Button>
        </div>
      </div>

      {a.status === "failed" && a.last_error && (
        <div className="mb-6 border-l-4 border-destructive bg-destructive/10 p-4 text-sm">
          <b>Last publish failed:</b> {a.last_error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          <Input className="mb-4 h-auto border-0 border-b bg-transparent px-0 py-2 font-serif text-3xl font-extrabold shadow-none focus-visible:ring-0" value={f.title} onChange={set("title")} />
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="markdown">Markdown</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="border border-border bg-card p-8">
                {f.excerpt && <p className="mb-6 font-serif text-lg italic text-muted-foreground">{f.excerpt}</p>}
                <div className="prose-article" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
            </TabsContent>
            <TabsContent value="markdown">
              <Textarea className="min-h-[600px] font-mono text-sm" value={f.content_markdown} onChange={set("content_markdown")} />
            </TabsContent>
            <TabsContent value="html">
              <pre className="max-h-[600px] overflow-auto bg-foreground p-4 font-mono text-xs text-background">{html}</pre>
            </TabsContent>
          </Tabs>
          <p className="mt-2 font-mono text-xs text-muted-foreground">{words} words</p>
        </div>

        <aside className="space-y-6">
          <section className="border border-border bg-card p-4">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-accent">Schedule</p>
            <Label className="mb-1 block">Website</Label>
            <select className="mb-3 h-9 w-full border border-input bg-background px-2 text-sm" value={f.site_id ?? ""} onChange={(e) => setF({ ...f, site_id: e.target.value || null })}>
              <option value="">— None —</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Label className="mb-1 block">Publish at</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                disabled={!!busy || !when}
                onClick={() =>
                  act("schedule", async () => {
                    const at = new Date(when);
                    if (at.getTime() < Date.now()) throw new Error("Pick a time in the future");
                    await persist();
                    await schedule({ data: { id, scheduled_at: at.toISOString() } });
                  }, "Scheduled")
                }
              >
                Schedule
              </Button>
              {a.status === "scheduled" && (
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("unschedule", () => schedule({ data: { id, scheduled_at: null } }), "Moved back to draft")}>
                  Unschedule
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Scheduled posts go out within ~5 minutes of the chosen time.</p>
          </section>

          <section className="border border-border bg-card p-4 space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-accent">SEO</p>
            <div>
              <Label className="mb-1 flex justify-between"><span>SEO title</span><span className="text-muted-foreground">{f.seo_title.length}/60</span></Label>
              <Input value={f.seo_title} onChange={set("seo_title")} />
            </div>
            <div>
              <Label className="mb-1 block">Slug</Label>
              <Input className="font-mono text-xs" value={f.slug} onChange={set("slug")} />
            </div>
            <div>
              <Label className="mb-1 flex justify-between"><span>Meta description</span><span className="text-muted-foreground">{f.meta_description.length}/155</span></Label>
              <Textarea rows={3} value={f.meta_description} onChange={set("meta_description")} />
            </div>
            <div>
              <Label className="mb-1 block">Excerpt</Label>
              <Textarea rows={2} value={f.excerpt} onChange={set("excerpt")} />
            </div>
            <div>
              <Label className="mb-1 block">Tags</Label>
              <Input value={f.tags} onChange={set("tags")} />
            </div>
            <div>
              <Label className="mb-1 block">Cover image prompt</Label>
              <Textarea rows={3} value={f.cover_image_prompt} onChange={set("cover_image_prompt")} />
            </div>
          </section>

          <section className="border border-border bg-card p-4">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">AI editor</p>
            <Textarea rows={2} placeholder="Optional: e.g. make it punchier, add an FAQ section" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            <Button
              size="sm"
              className="mt-2"
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                act("optimize", async () => {
                  await persist();
                  await optimize({ data: { id, instruction } });
                }, "Article optimized")
              }
            >
              {busy === "optimize" ? "Optimizing…" : "Optimize with AI"}
            </Button>
          </section>

          {(a.citations as { title: string; url: string }[])?.length > 0 && (
            <section className="border border-border bg-card p-4">
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-accent">Research sources</p>
              <ol className="list-decimal space-y-1 pl-4 text-sm">
                {(a.citations as { title: string; url: string }[]).map((c) => (
                  <li key={c.url}>
                    <a href={c.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">{c.title || c.url}</a>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <Button
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!confirm("Delete this article?")) return;
              await remove({ data: { id } });
              qc.invalidateQueries({ queryKey: ["articles"] });
              navigate({ to: "/" });
            }}
          >
            Delete article
          </Button>
        </aside>
      </div>
    </div>
  );
}
