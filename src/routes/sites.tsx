import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listSites, saveSite, deleteSite, analyzeSite, type SiteAnalysis } from "@/lib/api.functions";
import { PageHeader, Empty, errMsg } from "@/components/desk";
import { ReceiverSnippets } from "@/components/receiver-snippets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/sites")({
  head: () => ({
    meta: [
      { title: "Websites — The Desk" },
      { name: "description", content: "Manage the websites your AI agents publish to, and analyze their voice and audience." },
      { property: "og:title", content: "Websites — The Desk" },
      { property: "og:description", content: "Manage publishing websites and analyze their voice and audience." },
    ],
  }),
  component: SitesPage,
});

type SiteRow = Awaited<ReturnType<typeof listSites>>[number];
const blank = { name: "", url: "", endpoint_url: "", api_key: "", default_author: "", default_category: "" };

function SitesPage() {
  const qc = useQueryClient();
  const sites = useQuery({ queryKey: ["sites"], queryFn: useServerFn(listSites) });
  const [editing, setEditing] = useState<(typeof blank & { id?: string; api_key_hint?: string }) | null>(null);
  const save = useServerFn(saveSite);
  const remove = useServerFn(deleteSite);
  const list = sites.data ?? [];

  const onSave = async () => {
    if (!editing) return;
    try {
      await save({ data: editing });
      toast.success("Website saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["sites"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader kicker={`${list.length} website${list.length === 1 ? "" : "s"}`} title="Websites">
        <Button onClick={() => setEditing({ ...blank })}>
          Add website
        </Button>
      </PageHeader>

      {editing && (
        <div className="mb-8 border border-foreground bg-card p-6">
          <h2 className="mb-4 text-2xl font-semibold">{editing.id ? "Edit website" : "New website"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["name", "Website name", "My Travel Blog"],
                ["url", "Website link", "https://mysite.lovable.app"],
                ["endpoint_url", "Publishing endpoint", "https://mysite.lovable.app/api/public/posts"],
                ["api_key", "Secret API key", editing.api_key_hint ? `Saved (${editing.api_key_hint}) — leave blank to keep` : "Same value as BLOG_PUBLISH_KEY"],
                ["default_author", "Default author", "Jane Doe"],
                ["default_category", "Default category", "Guides"],
              ] as const
            ).map(([k, label, ph]) => (
              <div key={k}>
                <Label className="mb-1 block">{label}</Label>
                <Input
                  type={k === "api_key" ? "password" : "text"}
                  placeholder={ph}
                  value={editing[k]}
                  onChange={(e) => setEditing({ ...editing, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={onSave}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {list.length === 0 && !editing ? (
        <Empty>Add the websites your agents will publish to.</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {list.map((s) => (
            <SiteCard
              key={s.id}
              site={s}
              onEdit={() => setEditing({ ...blank, ...s, api_key: "" })}
              onDelete={async () => {
                if (!confirm(`Remove ${s.name}?`)) return;
                await remove({ data: { id: s.id } });
                qc.invalidateQueries({ queryKey: ["sites"] });
              }}
            />
          ))}
        </div>
      )}

      <ReceiverSnippets />
    </div>
  );
}

function SiteCard({ site, onEdit, onDelete }: { site: SiteRow; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeSite);
  const [busy, setBusy] = useState(false);
  const a = site.analysis as SiteAnalysis | null;

  const run = async () => {
    if (!site.url) { toast.error("Add the website link first"); return; }
    setBusy(true);
    try {
      await analyze({ data: { id: site.id, url: site.url } });
      toast.success("Analysis complete");
      qc.invalidateQueries({ queryKey: ["sites"] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col border border-border bg-card p-5">
      <h3 className="text-2xl font-semibold">{site.name}</h3>
      <p className="truncate font-mono text-xs text-muted-foreground">{site.url || "No link"}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Endpoint</dt>
        <dd className="truncate">{site.endpoint_url || <span className="text-destructive">not set</span>}</dd>
        <dt className="text-muted-foreground">API key</dt>
        <dd>{site.has_api_key ? site.api_key_hint : <span className="text-destructive">not set</span>}</dd>
        <dt className="text-muted-foreground">Defaults</dt>
        <dd>{[site.default_author, site.default_category].filter(Boolean).join(" · ") || "—"}</dd>
      </dl>

      <div className="mt-4 border-t border-border pt-3">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Website knowledge</p>
        {a ? (
          <div className="mt-2 space-y-1 text-sm">
            <p>{a.summary}</p>
            <p><b>Niche:</b> {a.niche}</p>
            <p><b>Audience:</b> {a.audience}</p>
            <p><b>Voice:</b> {a.tone_of_voice}</p>
            {a.content_themes?.length > 0 && <p className="text-muted-foreground">Themes: {a.content_themes.join(", ")}</p>}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Not analyzed yet.</p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button size="sm" onClick={run} disabled={busy}>
          {busy ? "Analyzing…" : a ? "Re-analyze" : "Scan & analyze"}
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>Remove</Button>
      </div>
    </article>
  );
}
