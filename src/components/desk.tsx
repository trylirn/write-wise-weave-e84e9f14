import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-foreground pb-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-accent">{kicker}</p>
        <h1 className="mt-1 text-4xl font-extrabold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

const STATUS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-warning/20 text-foreground",
  publishing: "bg-warning/20 text-foreground",
  published: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-block px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider", STATUS[status] ?? STATUS["draft"])}>
      {status}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-border p-10 text-center text-muted-foreground">{children}</div>;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
