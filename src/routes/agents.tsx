import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAgents, saveAgent, deleteAgent, listSites } from "@/lib/api.functions";
import { PageHeader, Empty, errMsg } from "@/components/desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agents — The Desk" },
      { name: "description", content: "Create AI writing agents with their own persona, tone, style, length and target website." },
      { property: "og:title", content: "Agents — The Desk" },
      { property: "og:description", content: "Create customizable AI writing agents." },
    ],
  }),
  component: AgentsPage,
});

type Draft = {
  id?: string;
  name: string;
  persona: string;
  tone: string;
  writing_style: string;
  target_length: number;
  formatting_rules: string;
  site_id: string | null;
  autopilot: boolean;
  articles_per_day: number;
};
const blank: Draft = {
  name: "",
  persona: "",
  tone: "",
  writing_style: "",
  target_length: 1200,
  formatting_rules: "Use short paragraphs, descriptive ## subheadings, at least one bulleted list, and a clear conclusion.",
  site_id: null,
  autopilot: true,
  articles_per_day: 1,
};

function AgentsPage() {
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["agents"], queryFn: useServerFn(listAgents) });
  const sites = useQuery({ queryKey: ["sites"], queryFn: useServerFn(listSites) });
  const save = useServerFn(saveAgent);
  const remove = useServerFn(deleteAgent);
  const [d, setD] = useState<Draft | null>(null);

  const onSave = async () => {
    if (!d) return;
    try {
      await save({ data: d });
      toast.success("Agent saved");
      setD(null);
      qc.invalidateQueries({ queryKey: ["agents"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader kicker="The writing staff" title="Agents">
        <Button onClick={() => setD({ ...blank })}>Hire an agent</Button>
      </PageHeader>

      {d && (
        <div className="mb-8 border border-foreground bg-card p-6">
          <h2 className="mb-4 text-2xl font-semibold">{d.id ? "Edit agent" : "New agent"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1 block">Name</Label>
              <Input value={d.name} placeholder="The Travel Insider" onChange={(e) => setD({ ...d, name: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Publishes to</Label>
              <select
                className="h-9 w-full border border-input bg-background px-3 text-sm"
                value={d.site_id ?? ""}
                onChange={(e) => setD({ ...d, site_id: e.target.value || null })}
              >
                <option value="">— No website —</option>
                {(sites.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1 block">Persona</Label>
              <Textarea rows={3} value={d.persona} placeholder="A seasoned travel journalist who has lived in 12 countries…" onChange={(e) => setD({ ...d, persona: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Tone</Label>
              <Input value={d.tone} placeholder="Warm, witty, confident" onChange={(e) => setD({ ...d, tone: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Target length (words)</Label>
              <Input type="number" min={200} max={6000} value={d.target_length} onChange={(e) => setD({ ...d, target_length: Number(e.target.value) || 1200 })} />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1 block">Writing style</Label>
              <Textarea rows={2} value={d.writing_style} placeholder="Second person, story-driven intros, concrete examples, no clichés" onChange={(e) => setD({ ...d, writing_style: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1 block">Formatting rules</Label>
              <Textarea rows={3} value={d.formatting_rules} onChange={(e) => setD({ ...d, formatting_rules: e.target.value })} />
            </div>
            <label className="flex items-center gap-3 border border-border bg-background p-3">
              <Switch checked={d.autopilot} onCheckedChange={(v) => setD({ ...d, autopilot: v })} />
              <span>
                <span className="block font-medium">Autopilot</span>
                <span className="text-sm text-muted-foreground">Picks topics, writes, checks and publishes on its own.</span>
              </span>
            </label>
            <div>
              <Label className="mb-1 block">Articles per day</Label>
              <Input type="number" min={1} max={24} value={d.articles_per_day} onChange={(e) => setD({ ...d, articles_per_day: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })} />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={onSave}>Save agent</Button>
            <Button variant="ghost" onClick={() => setD(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {(agents.data ?? []).length === 0 && !d ? (
        <Empty>No agents yet. Hire your first writer.</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {(agents.data ?? []).map((a) => (
            <article key={a.id} className="flex flex-col border border-border bg-card p-5">
              <h3 className="text-xl font-semibold">{a.name}</h3>
              <p className="font-mono text-xs text-muted-foreground">
                {sites.data?.find((s) => s.id === a.site_id)?.name ?? "No website"} · ~{a.target_length} words
              </p>
              <p className="mt-3 line-clamp-3 text-sm">{a.persona || "No persona"}</p>
              <p className="mt-2 text-sm italic text-muted-foreground">{a.tone}</p>
              <div className="mt-auto flex gap-2 pt-4">
                <Button size="sm" variant="outline" onClick={() => setD({ ...a })}>Edit</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Remove ${a.name}?`)) return;
                    await remove({ data: { id: a.id } });
                    qc.invalidateQueries({ queryKey: ["agents"] });
                  }}
                >
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
