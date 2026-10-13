<div align="center">
  <h1>LeadRadar</h1>
  <p><strong>Find the businesses that need you, before they know they need you.</strong></p>
  <p>An open-source AI agent that scans local businesses, spots the ones that need your service,<br/>and writes the first email for you.</p>
  <p>
    <img src="https://img.shields.io/badge/Gemma_3n-open_weights-1a73e8?style=for-the-badge&logo=google&logoColor=white" alt="Gemma 3n open weights"/>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
    <img src="https://img.shields.io/badge/Temporal-000000?style=for-the-badge&logo=temporal&logoColor=white" alt="Temporal"/>
    <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas"/>
    <img src="https://img.shields.io/badge/Hugging_Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black" alt="Hugging Face"/>
    <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Render"/>
    <img src="https://img.shields.io/badge/SerpApi-0EA5E9?style=for-the-badge" alt="SerpApi"/>
    <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License: MIT"/>
  </p>
  <p><em>Built for the Hacktoberfest 2026 Open-Source AI Challenge — Week 2: Side Hustle</em></p>
</div>

---

## The problem

Freelancers are good at their craft and terrible at finding people who need it.

My friend David designs websites. He's brilliant at it. But every Monday morning I watch him do the
same thing: pull up Google Maps, scroll through a few hundred businesses, squint at ratings, open
tabs, and read through them one at a time to figure out which ones actually need help. Three hours
in, he has a list of eleven businesses and a headache.

The work isn't hard. It's just *slow*, and it's exactly the kind of slow a model should do.

So I built LeadRadar, and gave it the boring half of his job.

## What it does

You tell it two things: **what you do** and **where you do it**. LeadRadar handles the rest.

1. **Finds local businesses** through SerpApi — real Google Maps data, not stale directories.
2. **Reads each one like a prospector would.** Gemma 3n scores every business 0–100 on how badly
   they need your service, and says *why*: no website, a broken one, a 9-review shop that never
   replies, an empty Google Business profile.
3. **Ranks the list** so the strongest leads sit at the top.
4. **Writes the first email.** For the top ten, it drafts something specific — not "Dear business
   owner, I noticed you could benefit from web design services." It mentions the 4.6 stars, the
   missing website, the exact problem it spotted. Something you'd actually be OK sending.

**The interesting part:** the reason this is *possible* for a freelancer is the same reason judges
care about open-source AI. See [Why open matters](#why-open-innovation-matters) for the honest answer.

<div align="center">
  <img src="docs/images/scan-form.svg" alt="The scan form" width="640"/>
  <p><sub><em>The form. Two fields, four checkboxes, one button.</em></sub></p>
  <br/>
  <img src="docs/images/results-table.svg" alt="The results table with drafted outreach" width="640"/>
  <p><sub><em>Results. Ranked, explained, and one email away from a real conversation.</em></sub></p>
</div>

---

## Demo

> **Live:** `[your-app].onrender.com` — deployed on Render. Try a scan for `Web Development` in your own city.

```bash
# Run it locally
git clone https://github.com/mudit-palvadi/lead-radar.git
cd leadradar
npm install
cp .env.example .env      # add your tokens
npm run worker            # terminal 1
npm run dev               # terminal 2
```

Then open `http://localhost:3000`, type a service and a city, and hit **Start Scan**.

The first scan takes a minute or two. After that it's fast — see
[the timing note](#performance) below.

---

## How it's built

```
     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
     │   SerpApi   │ ──▶ │   Gemma 3n   │ ──▶ │   Outreach   │
     │  (find them)│     │  (read them) │     │ (reach out)  │
     └─────────────┘     └──────┬───────┘     └──────────────┘
                                  │
                         ┌────────┴────────┐
                         │    Temporal     │
                         │ (durable, retry)│
                         └────────┬────────┘
                                  │
                         ┌────────┴────────┐
                         │  MongoDB Atlas  │
                         │  (every lead)   │
                         └─────────────────┘
```

The whole pipeline runs as one **Temporal** workflow — scan, classify, draft — so a Hugging Face
timeout or a flaky SerpApi call becomes a retry instead of a lost scan. Every lead, score and draft
is stored in **MongoDB Atlas**, so a scan you ran last week is still there when you come back.

### The stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** on Node 22 | Strict types on a multi-step pipeline catch bad data before it becomes a bad email. |
| The brain | **Gemma 3n** via Hugging Face Inference API | An *open-weight* model. Same model, your own keys, no proprietary lock-in. |
| The durable part | **Temporal** | Scans take minutes and hit flaky APIs. Retries and resume are not optional. |
| The data | **MongoDB Atlas** | Leads, scores and drafts; free tier is plenty. |
| The source | **SerpApi** | Live Google Maps results. Sample-data fallback if you have no key yet. |
| The host | **Render** | One `render.yaml` blueprint for the API and the worker. |
| The front end | A single HTML file | No build step, no framework, works on a phone. |

---

## Why open innovation matters

This one is not a slogan. It's the arithmetic.

**Closed-API pricing would break the thing.** LeadRadar runs Gemma 3n twice per lead — once to
score it, once to write the email. Roughly **50 model calls for a 25-lead scan**. A typical hosted
model API bills by the token, and by the time you've paid to classify *and* draft for every lead,
you've spent real money every time a freelancer hits "Start Scan".

With Gemma's open weights, **the marginal cost per lead is effectively zero**. My friend's
three-hour Monday morning costs nothing to replace.

That has a second effect, and it's the one that matters for the "side hustle" part of this challenge:

**$0 per lead changes what you can charge.** If each scan costs you nothing, this can be a tool a
freelancer *pays* $20 a month for — and you still keep a business, because the AI running it doesn't
have a bill attached. That entire category of small, specific, useful software exists *because* the
model at the centre of it is open.

And practically: **open weights mean you can leave.** Swap Gemma for Qwen, Llama or Mistral by
changing one variable. The pipeline doesn't care, because it never did.

---

## <a id="performance"></a> Performance, honestly

The first scan is slower than it should be: loading the model into the Hugging Face free tier can
take 20–30 seconds before the first lead comes back. After that, calls are a few seconds each.

Classification runs in **batches of five**, email drafting in **threes**, so a scan finishes in
roughly the time of its slowest call — not the sum of all of them. If one lead's call fails, `Promise.allSettled`
means the other nineteen still land in your table.

---

<a id="first-user"></a>
## The first user

*This section is filled in after David runs his first scan — his words, not mine.*

> _"..."_ — David, freelance web designer

---

## Prize categories

This submission enters:

- **Best Use of Gemma** — Gemma 3n is the classifier and the email writer.
- **Best Use of Temporal** — the scan/classify/draft pipeline is one durable workflow with retries.
- **Best Use of MongoDB Atlas** — every lead, score and draft persists here.
- **Best Use of SerpApi** — every lead comes from live Google Maps data.
- **Best Use of Render** — the API and worker both deploy from `render.yaml`.

---

## License

MIT. Take it, run it, sell it. That's the point.
