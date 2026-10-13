# LeadRadar

An open-source AI agent that scans business directories, identifies companies that need your service, and drafts personalized outreach — so freelancers stop cold-calling and start warm-emailing.

Built with open-source AI at its core: Gemma 3n (Google's open-weight model) via Hugging Face Inference API for lead classification and email drafting, Temporal for durable workflow orchestration.

## Architecture

```
SerpApi (search) -> Gemma 3n via Hugging Face (classify) -> Outreach (draft email)
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

# 3. Start Temporal (local dev)
temporal server start-dev

# 4. Run the worker (in one terminal)
npm run worker

# 5. Run the API server (in another terminal)
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `HF_TOKEN` | Yes | Hugging Face access token |
| `HF_MODEL` | No | Model ID (default: `google/gemma-3-4b-it`) |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `SERPAPI_KEY` | No | SerpApi key (falls back to sample data) |
| `TEMPORAL_ADDRESS` | No | Temporal server (default: `localhost:7233`) |
| `PORT` | No | API port (default: `3000`) |

## Deploy on Render

See [README-RENDER.md](README-RENDER.md) for full deployment instructions.

## License

MIT
