# AI Content Butler

Build a tool where I can create fully customizable AI agents that write articles and blogs and automatically publish or schedule them to 4 custom-built Lovable websites.

Key requirements:
1. Target Website Management: Add and manage 4 custom-built Lovable websites, configuring each site's name, URL, webhook/API publishing endpoint, secret API key for authentication, and default author or category. Provide clear instructions and ready-to-use edge function/API code snippets for the Lovable websites to receive and store incoming posts.
2. Website Knowledge & Analysis: Ability to input a website link, scan and analyze its content, tone of voice, target audience, and niche to guide the AI writing.
3. Customizable AI Agents: Create distinct AI writing agents with customizable persona, tone, writing style, target length, formatting rules, and assigned target website.
4. Perplexity Web Research: Integrate Perplexity search for keywords so the agent searches the live web, extracts real-time context and citations, and weaves them into the generated articles.
5. Article Generation & Review: An intuitive workspace to generate, preview, edit, and optimize articles (with SEO titles, slugs, meta descriptions, headings, markdown/HTML content, and cover image prompts).
6. Scheduling & Auto-Publishing: Schedule articles for future automated publishing or publish immediately to the target website's webhook endpoint, with a publishing log and status tracker (draft, scheduled, published, failed).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://write-wise-weave.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/604a2dde-2548-4b8a-a039-fe2e71a8ba71).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
