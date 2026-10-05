# Fix "No output generated" and lower running costs

## What is happening
- Both agents failed overnight (01:45 and 04:55 UTC) with "No output generated".
- The AI request log has no calls at those times, so the AI service turned the requests down before writing anything.
- Your screenshot shows exactly 4 credits of AI used, which is the full free monthly AI allowance. The most likely cause is that the allowance ran out (unconfirmed; the real error was hidden).
- The app hid the real reason and showed a generic message. Because of that, it also did not pause the agents. They keep trying every 12 hours.

## Fixes
1. **Show the real reason.** Keep the actual error (for example "Out of AI credits") and show it on the Autopilot page.
2. **Pause properly.** When credits run out or AI access is blocked, switch that agent's Autopilot off and say why. Turning it back on restarts it.
3. **Then test.** Run one agent once to confirm the real message appears.

## Lower costs
Each article costs about 1.5–2 AI credits (topic, writing, check, fix, re-check), and the check runs every 5 minutes.
- **Cheaper articles:** use lighter AI thinking for topic picking and the Google check. Do the check and fix in one step. Skip the second check when the first score is 85 or higher. Expected saving: about 40–50% per article.
- **Fewer timed checks:** run the timed check every hour instead of every 5 minutes. Scheduled posts can go out up to 1 hour late. This cuts the database cost shown in your screenshot (2.58).
- **Suggested setting:** 1 article per day per agent until credits are topped up.

Note: when the free AI allowance is used up, new articles need paid credits (Settings → Plans & credits).

## Technical details
- `ai.server.ts`: in the custom fetch, save the non-OK error to a variable. After `await result.text` (wrapped in a try/catch), rethrow the saved error (402/403 messages) instead of AI SDK's `NoOutputGeneratedError`. Treat 403 the same way.
- `runDueAutopilot`: pause on the 402/403 messages. Errors match on `credits|limit|\[40[23]\]`.
- Add an optional `effort` param to `generateText` ("low" for discoverTopic and review; "medium" for writing). Merge review and fix into a single call that returns the score, the items and the corrected fields. Run the re-review only if the score is below 85.
- Reschedule pg_cron `publish-due-articles` to `0 * * * *`.
