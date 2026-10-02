import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLogs } from "@/lib/api.functions";
import { PageHeader, Empty } from "@/components/desk";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Publishing log — The Desk" },
      { name: "description", content: "Every publish attempt to your websites, with success or failure details." },
      { property: "og:title", content: "Publishing log — The Desk" },
      { property: "og:description", content: "Every publish attempt with success or failure details." },
    ],
  }),
  component: LogPage,
});

function LogPage() {
  const logs = useQuery({ queryKey: ["logs"], queryFn: useServerFn(listLogs), refetchInterval: 30000 });
  const list = logs.data ?? [];
  return (
    <div>
      <PageHeader kicker="The wire" title="Publishing log" />
      {list.length === 0 ? (
        <Empty>No publish attempts yet.</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-foreground text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2">When</th>
              <th>Article</th>
              <th>Website</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className="border-b border-border align-top">
                <td className="py-3 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="pr-3">
                  {l.article_id ? (
                    <Link to="/articles/$id" params={{ id: l.article_id }} className="font-serif hover:text-accent">
                      {(l.articles as { title: string } | null)?.title || "Untitled"}
                    </Link>
                  ) : "—"}
                </td>
                <td className="pr-3">{(l.sites as { name: string } | null)?.name ?? "—"}</td>
                <td className={`pr-3 font-mono text-xs uppercase ${l.success ? "text-success" : "text-destructive"}`}>
                  {l.success ? "OK" : "Failed"} {l.http_status ?? ""}
                </td>
                <td className="max-w-md break-words text-muted-foreground">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
