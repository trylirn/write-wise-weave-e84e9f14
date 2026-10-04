import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { autopilotStatus, listSites } from "@/lib/api.functions";
import { PageHeader, Empty } from "@/components/desk";

export const Route = createFileRoute("/write")({
  head: () => ({
    meta: [
      { title: "Autopilot — The Desk" },
      { name: "description", content: "Agents research, pick topics and keywords, write, check against Google's guidelines and publish automatically." },
      { property: "og:title", content: "Autopilot — The Desk" },
      { property: "og:description", content: "Fully automated research, writing and publishing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WritePage,
});

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

function WritePage() {
  const status = useQuery({ queryKey: ["autopilot"], queryFn: useServerFn(autopilotStatus), refetchInterval: 30_000 });
  const sites = useQuery({ queryKey: ["sites"], queryFn: useServerFn(listSites) });
  const agents = status.data?.agents ?? [];
  const articles = status.data?.articles ?? [];

  if (status.isSuccess && agents.length === 0)
    return (
      <div>
        <PageHeader kicker="Autopilot desk" title="Autopilot" />
        <Empty>Add a <Link to="/sites" className="underline">website</Link> and an <Link to="/agents" className="underline">agent</Link> — the agent takes it from there.</Empty>
      </div>
    );

  return (
    <div>
      <PageHeader kicker="Autopilot desk" title="The newsroom runs itself" />
      <p className="mb-8 max-w-2xl text-muted-foreground">
        Each agent researches its site's niche with Perplexity, picks a fresh topic and keywords, writes, checks the article against Google's SEO starter guide, fixes issues, and publishes. Runs only on the published app.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        {agents.map((a) => (
          <article key={a.id} className="border border-border bg-card p-5">
            <p className={`font-mono text-xs uppercase tracking-widest ${a.autopilot ? "text-success" : "text-muted-foreground"}`}>
              {a.autopilot ? "● On autopilot" : "○ Paused"}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{a.name}</h3>
            <p className="text-sm text-muted-foreground">{sites.data?.find((s) => s.id === a.site_id)?.name ?? "No website"}</p>
            <p className="mt-3 text-sm"><b>{a.articles_per_day}</b> article{a.articles_per_day > 1 ? "s" : ""} per day</p>
            <p className="text-sm">Next: {a.autopilot ? fmt(a.next_run_at) : "—"}</p>
            <p className="text-sm">Last: {fmt(a.last_run_at)}</p>
            {a.last_error && <p className="mt-2 text-sm text-destructive">{a.last_error}</p>}
          </article>
        ))}
      </div>
      <h2 className="mb-3 mt-10 text-2xl font-semibold">Recent autopilot articles</h2>
      {articles.length === 0 ? (
        <Empty>No automated articles yet.</Empty>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {articles.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <Link to="/articles/$id" params={{ id: x.id }} className="font-serif text-lg hover:underline">{x.title}</Link>
                <p className="text-xs text-muted-foreground">{x.keywords} · {fmt(x.created_at)}</p>
              </div>
              <div className="text-right font-mono text-xs">
                <p>{x.status}</p>
                <p>Google check: {x.seo_score ?? "—"}/100</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
