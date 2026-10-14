# LeadRadar Test Report 1

| | |
|---|---|
| **Date** | 14 October 2026 |
| **Commit tested** | `9d0754e` (fix: request JSON mode from providers and tighten output contracts) |
| **Branch** | `main` |
| **Environment** | Windows 10 (build 26300), Node v22.16.0, local API and worker |
| **External services** | Temporal Cloud, MongoDB Atlas, SerpApi, Groq (model `allam-2-7b` from `.env`) |
| **Code changes during testing** | None |

## Summary

The backend works end to end. A real scan finds businesses on Google Maps, scores them with the AI
model, drafts outreach emails, and saves everything to MongoDB.

The web page can't show results, though. It spins on "Scanning for leads..." forever, even after
the scan finishes. On top of that, the API doesn't serve the page at all, 3 of the 22 unit tests
are out of date, and the AI output contains a lot of factually wrong signals.

| Area | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | Pass |
| Unit tests (`vitest run`) | 19 of 22 pass, 3 fail |
| Worker startup (Temporal Cloud) | Pass |
| API startup (MongoDB Atlas) | Pass |
| `GET /api/health` | Pass |
| Request validation (`POST /api/scans` with bad body) | Pass (HTTP 400) |
| End-to-end scan through the API | Pass (about 59s, 10 leads, all scored and drafted) |
| Web page served at `http://localhost:3000/` | **Fail** ("Cannot GET /") |
| Scan through the web page | **Fail** (results never appear) |
| Quality of AI scoring and emails | **Poor** (see findings) |

## How it was tested

1. Clean dependency install with `npm ci`. The first attempt left `node_modules` without the esbuild
   binary, so the folder was removed and reinstalled.
2. Ran `npx vitest run` and `npx tsc --noEmit`.
3. Started the worker (`npm run worker`) and the API (`npm run dev`) using the existing `.env`.
4. Called the API directly: health check, an invalid scan request, then a real scan for
   "Web Development" in "Austin, TX" with 10 leads, polling until it finished.
5. Served `web/index.html` through a temporary proxy outside the repo on port 3001, which forwarded
   `/api` calls to the API, then ran the same scan from the browser form.
6. Read the worker log for errors and retries.

## Results

### Unit tests

```
Test Files  3 failed | 1 passed (4)
     Tests  3 failed | 19 passed (22)
```

All three failures are mistakes in the tests, not in the app:

| Test | Error | Cause |
|---|---|---|
| `src/config.test.ts:21` "loads correct default values" | `Cannot read properties of undefined (reading 'host')` | The test reads `config.ollama.host`. The setting now lives at `config.ai.ollama.host`, and the expected default models are also out of date. |
| `src/db/models.test.ts:27` "has request sub-fields" | `expected undefined to be defined` | `schema.path('request')` returns nothing for a nested Mongoose object. The test should check paths like `request.service`. |
| `src/search/serpapi.test.ts:31` "returns leads with the expected shape" | `expected false to be true` | The test compares `hasWebsite` to `true`. Sample leads get a website at random, so this test passes or fails at random. It should check `typeof lead.hasWebsite === 'boolean'`. |

### End-to-end scan through the API

Request: `service = "Web Development"`, `location = "Austin, TX"`, `maxLeads = 10`,
`criteria = ["noWebsite", "outdatedWebsite"]`.

| Elapsed | Status |
|---|---|
| 0s | `pending` |
| 3s | `classifying` |
| 7s | `drafting` |
| 59s | `complete` (10 leads, no error) |

The AI generated a list of business types to search for, SerpApi returned 10 leads, every lead got
a score, and every lead got a drafted email. Groq returned rate-limit errors (HTTP 429) on nearly
every batch. The retry logic in `src/ai/groq.ts` absorbed all of them, waiting up to 16 seconds,
and nothing failed. The rate limiting is most of why drafting takes about 50 seconds.

Results, highest score first:

| Score | Business | Rating (reviews) | Has website |
|---|---|---|---|
| 80 | Body Repairs & More (mobil & ready) | none | No |
| 70 | Austin | 5 (1) | No |
| 70 | Car Mechanic Austin | none | Yes |
| 70 | Park and Bark LLC | 4.9 (195) | Yes |
| 70 | Healthy Pet self-serve dog wash | 5 (3) | No |
| 60 | DOGONMASTER LLC Mobil Mechanic | 4.5 (20) | No |
| 60 | CAR CARE EXPERTS | 4.6 (42) | Yes |
| 60 | Pet Polishers | 3.9 (11) | Yes |
| 60 | Zoomin Groomin | 4.9 (51) | Yes |
| 60 | Kinokuniya Bookstore - Austin | 4.7 (2075) | Yes |

### Scan through the web page

The form loads and submits correctly, and the API creates the scan. After the scan finished, the
page's state was checked against the API:

| | Value |
|---|---|
| API status | `complete` |
| Leads returned by the API | 10 |
| Page status text | "Scanning for leads..." |
| Page button | "Scanning..." (disabled) |
| Result rows shown on the page | 0 |

Screenshots from this run were saved locally (not in the repo):

- Form filled in before submitting: `C:\Users\Asus\AppData\Local\Temp\cursor\screenshots\leadradar-test-form.png`
- Page still stuck after the scan completed: `C:\Users\Asus\AppData\Local\Temp\cursor\screenshots\leadradar-test-stuck.png`

## Findings

### 1. The web page never shows results (high severity)

`web/index.html` doesn't match what the API actually returns:

- Line 461 waits for `data.status === 'completed'`, but the API sends `'complete'`. Polling never
  stops and the results are never drawn.
- Line 467 reads `data.results`, but the API sends `leads`.
- Line 494 passes each signal straight into `escapeHtml(s)`, but signals are objects
  (`{ type, description, severity }`). Once the first two problems are fixed, every signal tag
  would read `[object Object]`. It should use `s.description`.
- The page only ever shows "Scanning for leads...". It ignores the `classifying` and `drafting`
  statuses the API reports along the way.

### 2. The API doesn't serve the web page (high severity)

`GET http://localhost:3000/` returns "Cannot GET /". `src/api/server.ts` only defines the `/api/*`
routes and never serves the `web/` folder. The README tells users to open `http://localhost:3000`,
so anyone following the setup steps hits a dead end. The production `Dockerfile` doesn't copy `web/`
into the image either.

### 3. Three unit tests are out of date (medium severity)

See the [unit test table](#unit-tests). Because the `serpapi.test.ts` failure is random, the suite
can't be trusted to give the same result twice in CI.

### 4. The AI writes signals that contradict the data (medium severity)

- **Every** lead was flagged "not listed on Google Business", but every lead came from Google Maps,
  so they are all listed.
- Leads that have a website were flagged "does not have a website" (high severity) alongside
  "website is outdated", which contradict each other. Kinokuniya Bookstore, with 2,075 reviews and
  a website, got both.
- Signals are duplicated. For example, "No website found" appears twice on several leads, once
  from the SerpApi checks and once from the AI, because the two lists are merged without removing
  repeats.
- "Website is in Spanish and may need an update" (CAR CARE EXPERTS) isn't based on any data the
  model was given.

### 5. Email drafts aren't ready to send (medium severity)

- A lead whose name is just "Austin" got an email opening "Dear Austin" that praised its
  "5-star rating and strong reviews". It has one review.
- That same email says it found the business "while searching for local web development
  providers", which treats the prospect as a competitor rather than a customer.
- Every email ends with a `[Your Name]` placeholder. The form has no field for the freelancer's
  name.
- The emails are long, generic, and read like templates ("I hope this email finds you well"),
  which is what the README says LeadRadar avoids.

### 6. Scores don't separate leads well (low severity)

All 10 scores fall between 60 and 80, and seven leads tie at 60 or 70. A bookstore with 2,075
reviews and a website scored the same as a mobile mechanic with no website. The ranking says
little about which leads are actually worth contacting.

### 7. Configured model doesn't match the README (low severity)

The worker log shows `[ai] using hosted Groq model: allam-2-7b`, which comes from `GROQ_MODEL` in
`.env`. `.env.example` and the README's setup table default to `qwen/qwen3.8-27b`, while the
README's badge, feature list, and stack table say Gemma 2 and its diagram says Qwen 3, so the README
also contradicts itself. A small 7B model may explain some of the quality problems in findings 4 to 6. The
business-type list it generated also included "book publisher", which isn't a typical local
storefront.

### 8. Groq rate limits slow every scan (low severity)

Nearly every batch of AI calls hit HTTP 429 and had to retry, with waits of up to 16 seconds. It
doesn't break anything, but it makes up most of the 59-second scan time. The batch sizes in
`src/workflow/activities.ts` (5 for scoring, 3 for drafting) run faster than the free tier allows.

### 9. `npm install` warning (informational)

Every npm command prints `npm warn Unknown env config "devdir"`. It comes from the local npm setup,
not the project, and is harmless now, but npm says it will stop working in a future major version.

## Recommended next steps

1. Fix the web page so it matches the API (`complete`, `leads`, `s.description`) and shows each
   step's status.
2. Serve `web/` from Express, and copy it into the Docker image.
3. Update the three stale tests.
4. Give the model the facts it needs to be accurate: tell it the business is already on Google
   Maps, state clearly whether it has a website, and remove duplicate signals.
5. Add a "your name" field to the form and fill it into the email drafts.
6. Set `GROQ_MODEL` to the model the README advertises, then compare output quality.
7. Rerun this test, then take the README demo screenshots.
