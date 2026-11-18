# Review guide — Schueler Monitor

This repository is a **source snapshot for code review**, not a runnable deployment.
It contains the public site, the scanner, the tests and the deployment units. The live
database, secrets and large video files are intentionally excluded (see
[What is excluded](#what-is-excluded)).

The site is a Polish/English editorial monitor of the case of **Richard James Schueler**
(Richard Heart / HEX / PulseChain), detained in Istanbul on 14.10.2026. The public page
is a newsroom-style dossier; the operational panel is separate and token-protected.

## Stack

- Node.js **22+**, ESM (`"type": "module"`), **no npm dependencies**.
- `node:http`, `node:sqlite`, global `fetch`.
- SQLite in WAL mode (`data/monitor.db` at runtime).
- No build step, no bundler, no framework. CSS is an inline template string in
  `src/web-ui.js`; client scripts are served from `src/*.js` as static assets.
- Tests use the built-in `node:test` runner.

## Entry points and data flow

```
src/index.js
  ├─ startWeb()        src/web.js          HTTP server + router
  └─ startLoop()       src/scanner.js      periodic scan loop
        ├─ collectAll() src/collector.js   fetch + parse sources
        │     └─ src/sources.js            118 source definitions
        ├─ evaluate()   src/matcher.js     relevance / noise filter
        ├─ dedupKey()   src/dedup.js       URL / Google News / content fingerprint
        ├─ storyKey()   src/story.js       group articles into one event
        ├─ isImportantAlert() src/alert-policy.js
        ├─ summarize()  src/summarizer.js  PL + EN summaries (OpenRouter, fallback)
        └─ notify()     src/discord.js     Discord webhook + digest
```

Runtime state lives in SQLite (`src/db.js`). The public page is rendered on every
request from that database plus the manually maintained editorial layer in
`src/facts.js`.

## Request map (`src/web.js`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Public home page (sections, archive, search, pagination) |
| GET | `/item/:id` | Public item page; hidden items return 404 |
| GET | `/media/:name.mp4` | Video with HTTP Range support |
| GET | `/api/items` | Public archive API: `limit` 1–100, `offset`, `q` |
| GET | `/api/latest?since=<ms>` | New items for the live panel (max 10) |
| GET | `/healthz` | Liveness/health JSON |
| GET | `/robots.txt` | Robots policy |
| GET | `/live.js`, `/auto.js`, `/countdown.js`, `/dossier.js` | Small client scripts |
| GET | `/ops` | Operational panel (requires session or Bearer token) |
| POST | `/ops/login`, `/ops/logout` | Signed session cookie / logout |
| GET | `/api/status`, `/api/notifications` | Admin JSON (Bearer token) |
| POST | `/api/scan`, `/scan`, `/test` | Manual scan/test actions (auth) |

Public HTML is rendered by `src/web-public.js` (sections) inside the shell and CSS from
`src/web-ui.js`. `/ops` lives in `src/web-ops.js`.

## Data model (`src/db.js`)

- `items` — one fetched publication: `id`, `dedup_key`, `content_key`, `source`,
  `source_label`, `title`, `title_pl`, `title_en`, `url`, `published_at`,
  `first_seen_at`, `raw_text`, `score`, `summary_pl`, `summary_en`,
  notification state and suppression state.
- `stories` — event grouping (`story_key`, detail level, last alert time).
- `notifications` — Discord delivery queue and errors.
- `source_state` — per-source health, failures, last success.
- `kv` — bootstrap flag, digest markers, small runtime state.

The live database is **not** in this repo. `data/` is created on first run.

## Editorial layer (important for content review)

- `src/facts.js` — `KEY_FACTS`, `LAST_CONFIRMED` (21.10.2026), `REVIEWED_AT`
  (16.11.2026), legal roadmap, deadlines and timeline. This file is edited manually;
  the monitor does not rewrite it.
- `src/facts-i18n.js` — English versions of the fact layer.
- `src/i18n.js` — PL/EN interface dictionary (`t(lang, key)`); default language is PL,
  `?lang=en` switches, cookie `mntr_lang`.
- Themes: `?theme=pulse` (default), `dossier`, `editorial`, `spectrum`; cookie
  `mntr_theme`.
- The “Przegląd monitora” / “Monitor review” panel is computed from the database at
  render time (`renderReview` in `src/web-public.js`), not hand-edited. It distinguishes
  a dated media item (`published_at`) from an undated reference item (shown with
  `first_seen_at` and labelled “wpis referencyjny, nie publikacja”).
- The edition line (`filing.edition`) says **“Wydanie redakcyjne · weryfikacja
  {date}”**, not “stan na”, because `REVIEWED_AT` is the editorial review date, while
  the last confirmed development remains 21.10.2026.

## Tests

```bash
npm test
```

156 tests cover classification, deduplication, event grouping, alert limits, database
migration, i18n, themes, auth, CSP, redaction, API shapes and the public page. Tests
create their own temporary databases; they do not need the production DB or `.env`.

Optional local run (not needed for review):

```bash
cp .env.example .env     # leave secrets empty; Discord is optional
npm start                # http://127.0.0.1:3010/
```

Without `ADMIN_TOKEN`, `/ops` is disabled. Without `DISCORD_WEBHOOK_URL`, alerts are
skipped but scanning and the public page still work.

## What is excluded

| Excluded | Why |
|---|---|
| `data/` (SQLite, health cache) | Live operational data, not source; may contain private/raw material |
| `.env` | Secrets (Discord webhook, OpenRouter key, admin token) |
| `public/media/*.mp4` | 182 MB of video; one file is 161 MB, above GitHub’s 100 MB file limit. The site serves them at runtime. |
| `research/`, root `*.xml`, `*.jsonl`, `*.json` scrapes | Working material and one-off extraction scripts, not part of the site |
| `.pq/`, agent instruction files, screenshots, old audit report | Tooling / stale artifacts |
| `node_modules/` | No dependencies are used |

`src/cli-*.js` **are** included: they are maintenance tools (scan, health, digest,
backfill, archive cleanup), not part of the HTTP request path, but they document the
data lifecycle and are referenced by `package.json`.

The files in `public/press/` are frames/stills already published on the live site.
They are third-party news material; rights remain with the original publishers. They
are included only so the gallery layout and captions can be reviewed together with the
code. The large MP4 files in `public/media/` are not included.

## Known issues / review targets

1. **Responsive layout** — verified with real CDP mobile emulation at 1440, 1024, 768
   and 390 px: no page-level horizontal overflow. The timeline clips (`.tl-clips`) are
   an intentional horizontal scroller; their cards extend beyond the viewport inside
   an `overflow-x:auto` container. Do not “fix” that by wrapping the page.
2. **Health count** — production has 118 sources. `/healthz` can briefly show 117/118
   when one source has repeated failures; `/ops` shows which one. This is operational
   state, not a code bug.
3. **Static editorial data** — facts and legal deadlines are manually maintained and
   date-driven. If a date passes, counters change but the prose does not rewrite itself.
4. **No framework / no build** — style changes belong in the template string in
   `src/web-ui.js`; there is no CSS file to edit.
5. **Language coverage** — Polish is the source language. EN labels and facts are
   translated, but source titles remain in the publisher’s language by design.
6. **README encoding** — the original README was double-encoded UTF-8; this snapshot
   contains the repaired version. Code files were checked for replacement characters
   and mojibake and are clean.

## Security notes

- Public pages escape text and only allow `http:`/`https:` links.
- CSP: `default-src 'none'; script-src 'self'; connect-src 'self'`.
- Admin routes require `ADMIN_TOKEN`; login uses a signed HttpOnly, SameSite=Strict
  session cookie and rate limiting.
- Private persons are redacted in titles, snippets, summaries, API and Discord
  notifications (`redactPrivate` in `src/facts.js`).

## Deployment

`deploy/` contains the systemd units and nginx example. Production runs the service
behind nginx; deployment is `scp` + `systemctl restart schueler-monitor`. Nothing in
this repo needs to be deployed for the review.
