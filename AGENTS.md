<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Article desk app
- No login by owner request: all data access goes through server functions using the admin client; tables have RLS with no policies (locked to the browser). Why: keeps site API keys server-only.
- AI writing uses the Lovable AI Gateway (Responses API) in src/lib/ai.server.ts; web research uses Perplexity Search via the connector gateway. Why: managed connection only allows /search.
- Scheduled publishing: pg_cron hits /api/public/hooks/publish-due every 5 min; the route only publishes already-due articles, so it needs no secret. Why: idempotent and claim-guarded.
