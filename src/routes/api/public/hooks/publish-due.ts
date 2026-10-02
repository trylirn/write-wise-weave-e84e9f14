import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { publishArticle } from "@/lib/publish.server";

export const Route = createFileRoute("/api/public/hooks/publish-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
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
        return Response.json({ processed: results.length, results });
      },
    },
  },
});
