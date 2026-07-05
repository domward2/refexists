# RUNBOOK.md — RefExists

## What's deployed where
- **Live**: https://refexists.dsl4.com — assets-only Cloudflare Worker named `refexists`
  on account `ac8ede1a17f9c13eac79e285f753aaa2` (Dom's hotmail CF account, wrangler OAuth).
- **No server code, no bindings, no KV/D1/queues.** The Worker only serves `public/`.
- **DNS**: exactly one record — the Workers custom domain for `refexists.dsl4.com`
  (created automatically by `wrangler deploy`). Apex/www untouched.
- **Canonical repo on this machine**: `~/Code/refexists` (own git repo, not inside Dexter).

## Local dev
```bash
cd ~/Code/refexists
python3 -m http.server 8471 --directory public   # any static server works
# open http://localhost:8471
```
No build step. No dependencies. Edit `public/*` directly.

## Tests (live-API, ~30s)
```bash
node test/run-tests.mjs        # 16 pass/fail cases incl. all harm classes
```
Run before every deploy. They hit real registries — a transient registry outage can
fail a live case; rerun before assuming regression.

## Deploy
```bash
cd ~/Code/refexists
node test/run-tests.mjs && npx --yes wrangler deploy
```
Deploy takes ~30s including propagation. Verify:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://refexists.dsl4.com   # expect 200
curl -sS https://refexists.dsl4.com/verifier.js | diff - public/verifier.js  # expect empty
curl -sS -o /dev/null -w "%{http_code}\n" https://dsl4.com             # expect 302 (Access) — root untouched
```

## Rollback
```bash
npx --yes wrangler deployments list          # find previous version id
npx --yes wrangler rollback                  # interactive; or redeploy a previous git commit
```
Or `git checkout <good-commit> -- public && npx wrangler deploy`.

## Teardown (if ever needed)
```bash
npx --yes wrangler delete --name refexists   # removes worker AND its custom domain/DNS record
```

## Dependencies that can rot (and what breaks)
| Dependency | If it changes | Symptom | Fix |
|---|---|---|---|
| Crossref REST API | rate limits tightened Dec 2025; mailto polite pool used | refs stuck at "Retry" | lower concurrency in verifier.js (`concurrency = 4`) |
| OpenAlex keyless budget ($0.10/day/IP, Feb 2026 regime) | budget shrinks | search fallback returns errors → more "No record → Retry" | it's fallback-only; degrade is graceful; consider asking users for their own free key |
| doi.org handle API | CORS policy change | fabricated-DOI check can't complete → "Retry" | route existence check through Crossref+DataCite only (weaker) |
| OpenAlex `is_retracted` | field rename | retraction flags silently vanish | test suite case "retracted paper → flagged retracted" catches this — run it |
| Cloudflare Bot Fight Mode | starts hard-challenging | curl gets 403/challenge | zone-level setting (Dom only) — do NOT change zone settings casually; see DECISIONS.md D8 |

## Monitoring
None deliberately (no analytics by design). Health check = the curl trio above.
If Dom wants uptime pings, use an external monitor against `/` (it's a static 200).

## Cost model
$0. Workers free tier (100k req/day) serves static assets; registry APIs are free
public infrastructure with per-visitor rate budgets. No metered API is called.
