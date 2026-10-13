# LeadRadar

An open-source AI agent that scans business directories, identifies companies that need your service, and drafts personalized outreach — so freelancers stop cold-calling and start warm-emailing.

Built with open-source AI at its core: Gemma 3n (Google's open-weight model) for lead classification and email drafting, Temporal for durable workflow orchestration, and a fully local-first architecture.

## Architecture

```
SerpApi (search) -> Gemma 3n (classify) -> Outreach (draft email)
                         |
                    Temporal (workflow engine)
                         |
                    MongoDB Atlas (lead store)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your keys

# 3. Start Ollama with Gemma 3n
ollama pull gemma3n:e4b

# 4. Start Temporal (local dev)
temporal server start-dev

# 5. Run the worker (in one terminal)
npm run worker

# 6. Run the API server (in another terminal)
npm run dev
```

## Environment Variables

See [.env.example](.env.example) for all required configuration.

## Deploy on Render

LeadRadar ships with a Render Blueprint — one click and your API + Temporal worker are live.

### Quick Deploy

1. Push this repo to GitHub.
2. On [Render](https://render.com/), go to **New** → **Blueprint** and select your repo.
3. Set the required environment variables (`MONGODB_URI`, `SERPAPI_KEY`, etc.).
4. Click **Apply** — Render provisions a **Web Service** (`leadradar-api`) and a **Background Worker** (`leadradar-worker`).

See [README-RENDER.md](README-RENDER.md) for full deployment instructions, manual setup, and troubleshooting.

### Docker

A `Dockerfile` is also included for container-based deployments.

## License

MIT
