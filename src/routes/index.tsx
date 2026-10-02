import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listArticles, listAgents, listSites } from "@/lib/api.functions";
import { PageHeader, StatusBadge, Empty } from "@/components/desk";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Front page — The Desk" },
      { name: "description", content: "Overview of your AI-written articles, drafts, schedules and publishing status." },
      { property: "og:title", content: "Front page — The Desk" },
      { property: "og:description", content: "Overview of your AI-written articles, drafts, schedules and publishing status." },
    ],
  }),
  component: Index,
});

function Index() {
  const articles = useQuery({ queryKey: ["articles"], queryFn: useServerFn(listArticles) });
  const agents = useQuery({ queryKey: ["agents"], queryFn: useServerFn(listAgents) });
  const sites = useQuery({ queryKey: ["sites"], queryFn: useServerFn(listSites) });
  const list = articles.data ?? [];
  const count = (s: string) => list.filter((a) => a.status === s).length;
  const siteName = (id: string | null) => sites.data?.find((s) => s.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader kicker={new Date().toDateString()} title="Today's edition">
        <Button asChild>
          <Link to="/write">Commission an article</Link>
        </Button>
      </PageHeader>

      <div className="mb-10 grid grid-cols-2 border-y border-foreground md:grid-cols-4">
        {(["draft", "scheduled", "published", "failed"] as const).map((s, i) => (
          <div key={s} className={`p-5 ${i ? "border-l border-border" : ""}`}>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{s}</p>
            <p className="font-serif text-4xl font-extrabold">{count(s)}</p>
          </div>
        ))}
      </div>

      {(sites.data?.length ?? 0) === 0 && (
        <div className="mb-8 border-l-4 border-accent bg-card p-5">
          <p className="font-serif text-xl font-semibold">Start here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            1. <Link to="/sites" className="underline">Add your websites</Link> · 2.{" "}
            <Link to="/agents" className="underline">Create a writing agent</Link> · 3.{" "}
            <Link to="/write" className="underline">Write your first article</Link>
          </p>
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-3">
        <section className="md:col-span-2">
          <h2 className="mb-3 border-b border-border pb-2 text-2xl font-semibold">Latest stories</h2>
          {list.length === 0 ? (
            <Empty>No articles yet.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {list.slice(0, 15).map((a) => (
                <li key={a.id} className="py-4">
                  <Link to="/articles/$id" params={{ id: a.id }} className="group block">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={a.status} />
                      <span className="font-mono text-xs text-muted-foreground">{siteName(a.site_id)}</span>
                    </div>
                    <p className="mt-1 font-serif text-xl font-semibold group-hover:text-accent">{a.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.status === "scheduled" && a.scheduled_at
                        ? `Goes live ${new Date(a.scheduled_at).toLocaleString()}`
                        : a.published_at
                          ? `Published ${new Date(a.published_at).toLocaleString()}`
                          : `Edited ${new Date(a.updated_at).toLocaleString()}`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <h2 className="mb-3 border-b border-border pb-2 text-2xl font-semibold">The staff</h2>
          {(agents.data ?? []).length === 0 ? (
            <Empty>No agents yet.</Empty>
          ) : (
            <ul className="space-y-3">
              {agents.data!.map((ag) => (
                <li key={ag.id} className="border border-border bg-card p-3">
                  <p className="font-serif font-semibold">{ag.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ag.tone || "No tone set"} · writes for {siteName(ag.site_id)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
