import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listAgents, listSites, generateArticle } from "@/lib/api.functions";
import { PageHeader, Empty, errMsg } from "@/components/desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/write")({
  head: () => ({
    meta: [
      { title: "Write — The Desk" },
      { name: "description", content: "Commission an AI agent to research the live web and write an SEO-ready article." },
      { property: "og:title", content: "Write — The Desk" },
      { property: "og:description", content: "Commission a researched, SEO-ready article from an AI agent." },
    ],
  }),
  component: WritePage,
});

function WritePage() {
  const navigate = useNavigate();
  const agents = useQuery({ queryKey: ["agents"], queryFn: useServerFn(listAgents) });
  const sites = useQuery({ queryKey: ["sites"], queryFn: useServerFn(listSites) });
  const generate = useServerFn(generateArticle);
  const [agentId, setAgentId] = useState("");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [research, setResearch] = useState(true);
  const [busy, setBusy] = useState(false);

  const list = agents.data ?? [];
  const selected = list.find((a) => a.id === (agentId || list[0]?.id));

  const onGo = async () => {
    if (!selected) { toast.error("Create an agent first"); return; }
    if (topic.trim().length < 3) { toast.error("Give the agent a topic"); return; }
    setBusy(true);
    try {
      const { id } = await generate({ data: { agent_id: selected.id, topic, keywords, research } });
      toast.success("Draft ready");
      navigate({ to: "/articles/$id", params: { id } });
    } catch (e) {
      toast.error(errMsg(e));
      setBusy(false);
    }
  };

  if (agents.isSuccess && list.length === 0)
    return (
      <div>
        <PageHeader kicker="Assignment desk" title="Write" />
        <Empty>
          You need a writing agent first. <Link to="/agents" className="underline">Create one</Link>.
        </Empty>
      </div>
    );

  return (
    <div>
      <PageHeader kicker="Assignment desk" title="Commission an article" />
      <div className="grid gap-10 md:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div>
            <Label className="mb-1 block">Agent</Label>
            <select
              className="h-10 w-full border border-input bg-background px-3"
              value={selected?.id ?? ""}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {list.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-1 block">Topic or headline idea</Label>
            <Input className="h-12 font-serif text-lg" value={topic} placeholder="The best hidden beaches in Portugal for 2026" onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Target keywords (comma separated)</Label>
            <Input value={keywords} placeholder="hidden beaches portugal, algarve coves" onChange={(e) => setKeywords(e.target.value)} />
          </div>
          <label className="flex items-center gap-3 border border-border bg-card p-4">
            <Switch checked={research} onCheckedChange={setResearch} />
            <span>
              <span className="block font-medium">Research the live web with Perplexity</span>
              <span className="text-sm text-muted-foreground">Pulls current facts and sources and cites them in the article.</span>
            </span>
          </label>
          <Button size="lg" onClick={onGo} disabled={busy}>
            {busy ? (research ? "Researching & writing… (up to a minute)" : "Writing… (up to a minute)") : "Write the article"}
          </Button>
        </div>
        <aside className="border-l border-border pl-6">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">The brief</p>
          {selected && (
            <div className="mt-2 space-y-2 text-sm">
              <p className="font-serif text-xl font-semibold">{selected.name}</p>
              <p>{selected.persona || "No persona set."}</p>
              <p><b>Tone:</b> {selected.tone || "—"}</p>
              <p><b>Length:</b> ~{selected.target_length} words</p>
              <p><b>Publishes to:</b> {sites.data?.find((s) => s.id === selected.site_id)?.name ?? "No website"}</p>
              {sites.data?.find((s) => s.id === selected.site_id)?.analysis ? (
                <p className="text-success">Uses this website's analyzed voice & audience.</p>
              ) : (
                <p className="text-muted-foreground">Tip: analyze the website for better on-brand writing.</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
