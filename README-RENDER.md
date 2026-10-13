# Deploy LeadRadar on Render

This guide walks you through deploying LeadRadar on [Render](https://render.com/) using the `render.yaml` Blueprint or a manual setup.

---

## Option 1: Blueprint Deployment (Recommended)

1. **Push your code to GitHub** — Render needs a Git repository to deploy from.

2. **Fork/import the LeadRadar repo** into your GitHub account.

3. **Go to the Render Dashboard** → **New** → **Blueprint**.

4. **Select your repository** — Render will detect `render.yaml` automatically.

5. **Set required environment variables** during the Blueprint setup:

   | Variable         | Description                          | Required |
   |------------------|--------------------------------------|----------|
   | `MONGODB_URI`    | MongoDB Atlas connection string      | Yes      |
   | `SERPAPI_KEY`    | SerpApi API key                      | Yes      |
   | `OLLAMA_HOST`    | Ollama server URL                    | No (defaults to `http://localhost:11434`) |
   | `OLLAMA_MODEL`   | Model name for Gemma 3n              | No (defaults to `gemma3n:e4b`) |
   | `TEMPORAL_ADDRESS` | Temporal server address            | No (defaults to `localhost:7233`) |
   | `TEMPORAL_NAMESPACE` | Temporal namespace              | No (defaults to `default`) |
   | `PORT`           | Auto-set by Render                   | No       |

6. **Click "Apply"** — Render will provision:
   - **leadradar-api** (Web Service) — the Express API on port 10000
   - **leadradar-worker** (Background Worker) — the Temporal worker

---

## Option 2: Manual Deployment

### Web Service (API)

1. **Dashboard** → **New** → **Web Service**
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `npm start`
4. **Health Check Path:** `/api/health`
5. **Environment:** Node
6. **Instance Type:** Free (or Starter for production)

### Background Worker (Temporal)

1. **Dashboard** → **New** → **Background Worker**
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `npm run worker`
4. **Environment:** Node
5. **Instance Type:** Free (or Starter for production)

---

## Required External Services

LeadRadar needs the following to function fully:

| Service | Purpose | Setup |
|---------|---------|-------|
| **MongoDB Atlas** | Lead storage | [Create a free cluster](https://cloud.mongodb.com/) and copy the connection string to `MONGODB_URI` |
| **SerpApi** | Business directory search | [Get an API key](https://serpapi.com/) and set `SERPAPI_KEY` |
| **Ollama** | Local AI (Gemma 3n) | Run `ollama pull gemma3n:e4b` on a GPU machine; set `OLLAMA_HOST` to that machine's URL |
| **Temporal** | Workflow orchestration | [Deploy Temporal Cloud](https://cloud.temporal.io/) or run a self-hosted Temporal server; set `TEMPORAL_ADDRESS` |

> **Note:** The free Render instances run in isolated containers. For Ollama and Temporal, you will need external hosting (e.g., a GPU VM for Ollama, Temporal Cloud for workflows).

---

## Health Check

Once deployed, verify the API is running:

```
GET https://<your-app-name>.onrender.com/api/health

# Expected response:
# { "status": "ok", "timestamp": "2026-10-13T..." }
```

---

## Docker Deployment (Alternative)

A `Dockerfile` is included if you prefer container-based deployment:

```bash
docker build -t leadradar .
docker run -p 3000:3000 \
  -e MONGODB_URI="your-mongodb-uri" \
  -e SERPAPI_KEY="your-serpapi-key" \
  -e OLLAMA_HOST="http://your-ollama-host:11434" \
  leadradar
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Health check fails | Check that `MONGODB_URI` is correct and MongoDB Atlas IP allowlist includes `0.0.0.0/0` |
| Worker crashes on start | Ensure `TEMPORAL_ADDRESS` points to a running Temporal server |
| Ollama connection refused | Verify `OLLAMA_HOST` is reachable from the Render instance (use a public URL, not `localhost`) |
| Build fails | Confirm Node.js version is set to 22 in environment variables |
