# Autopilot newsroom

Turn The Desk into a hands-off system: once websites and agents exist, agents pick their own topics and keywords from live research, write, check against Google's SEO starter guide, fix issues, and publish on a set frequency.

## What you will see
- **Agents page**: each agent gets an "Autopilot" switch and a frequency (e.g. 2 articles per day). Saving is all that's needed.
- **Write page** becomes the **Autopilot desk**: no topic or keyword boxes and no buttons. It shows each agent's frequency, next planned article time, the last topics chosen, and each article's Google guideline score. It refreshes on its own.
- **Editor**: shows the guideline checklist (passed / fixed items) for each article. Manual editing still works.

## How each automated article is made
1. Research: Perplexity searches trending questions in the site's niche and themes (from the site scan).
2. Topic and keywords: the AI picks a fresh topic plus 3-6 keywords, skipping anything similar to past articles for that site.
3. Write: the agent writes with live sources cited.
4. Google check: the AI reviews against the SEO starter guide (people-first helpful content, unique descriptive title, clear meta description, readable headings, descriptive slug, no keyword stuffing, cited sources, no invented facts) and returns a score and issues.
5. Fix: if issues are found, the article is revised once and re-scored.
6. Publish: sent straight to the agent's website and logged. Failures show as "failed" in the log.

## Frequency
Runs spread evenly across the day (2/day = every 12 hours). The existing timed check (every 5 minutes) also starts due autopilot runs, at most one article per run to keep cost and load safe. Like scheduled posts, this only runs once the app is published.

## Technical details
- Cleanup first: remove the stray `0001_autopilot` entry from the migration journal (no SQL file exists, nothing was applied).
- Migration: `agents` add `autopilot boolean default false`, `articles_per_day int default 1`, `next_run_at timestamptz`, `last_run_at timestamptz`, `last_error text`. `articles` add `seo_score int`, `seo_report jsonb default '[]'`, `auto_generated boolean default false`. Table `autopilot_lock` (single lease row) with service_role grants and RLS.
- `src/lib/autopilot.server.ts`: `discoverTopic`, `writeArticle` (refactored from generateArticle), `reviewSeo`, `reviseArticle`, `runAgent`.
- `publish-due` route: after due scheduled posts, acquire lease, pick one agent with autopilot on and `next_run_at <= now`, run it, set next_run_at = now + 24h / articles_per_day. On AI 402/403 pause that agent (autopilot off, error stored) instead of retrying.
- Manual generation stays available server-side but is removed from the Write page UI.
