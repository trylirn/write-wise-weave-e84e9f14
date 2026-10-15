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
- AI writing is DeepSeek first (secret DEEPSEEK_API_KEY, model deepseek-flash) with the Lovable AI Gateway as backup, both in src/lib/ai.server.ts; web research uses Perplexity Search via the connector gateway. Why: DeepSeek is cheaper, and the gateway keeps articles flowing if DeepSeek is down.
- Scheduled publishing: pg_cron hits /api/public/hooks/publish-due every 5 min; the route only publishes already-due articles, so it needs no secret. Why: idempotent and claim-guarded.
- Google SEO rules: src/lib/google-rules.server.ts re-reads Google's official docs once a week (called from publish-due) and stores the rules in table google_rules; the built-in rules are the fallback. Do not remove.
- Cover images: only agents whose name contains "intearior" get one (src/lib/cover-image.server.ts); failures never block the article. Stored in private bucket article-images with a 10-year signed link, since public buckets are blocked.
