import { createFileRoute } from "@tanstack/react-router";
import { publishArticle } from "@/lib/publish.server";

export const Route = createFileRoute("/api/public/hooks/publish-due")({
  server: {
    handlers: {
      // Open this link in a browser to see if DeepSeek and the weekly Google check are working.
      GET: async () => {
        const { getGoogleRulesStatus } = await import("@/lib/google-rules.server");
        return Response.json(await getGoogleRulesStatus());
      },
      // No secret needed: this only publishes articles already due, so extra calls are harmless.
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: due } = await supabaseAdmin
          .from("articles")
          .select("id")
          .eq("status", "scheduled")
          .lte("scheduled_at", new Date().toISOString())
          .order("scheduled_at")
          .limit(10);
        const results = [];
        for (const row of due ?? []) {
          // claim the row so overlapping runs don't double-publish
          const { data: claimed } = await supabaseAdmin
            .from("articles")
            .update({ status: "publishing" })
            .eq("id", row.id)
            .eq("status", "scheduled")
            .select("id");
          if (!claimed?.length) continue;
          results.push({ id: row.id, ...(await publishArticle(row.id)) });
        }
        // Once a week: re-read Google's official guidance and update the writing rules.
        // Any problem is caught here, so it can never stop publishing.
        const { refreshGoogleRulesIfDue } = await import("@/lib/google-rules.server");
        const googleRules = await refreshGoogleRulesIfDue().catch((e) => ({ error: String(e) }));
        const { runDueAutopilot } = await import("@/lib/autopilot.server");
        const autopilot = await runDueAutopilot().catch((e) => ({ error: String(e) }));
        return Response.json({ processed: results.length, results, autopilot, googleRules });
      },
    },
  },
});
