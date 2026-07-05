# RefExists

**https://refexists.dsl4.com** — do your references actually exist?

Paste a bibliography (or any text containing citations). Your browser checks every
reference directly against the world's scholarly registries — **Crossref, DataCite,
doi.org, OpenAlex, PubMed, Open Library** — and stamps each one with an
evidence-backed verdict. It catches:

- **Fabricated DOIs** — identifiers that no registration agency has ever issued
- **AI-hallucinated references** — plausible-looking citations with no matching record
  in 250M+ indexed works
- **Stitched citations** — a *real* DOI attached to a *different* paper's title/authors
  (the classic LLM fabrication signature)
- **Retracted works** cited as if they were valid evidence

## Why it's different

Every comparable checker (2024–2026 wave: CiteSure, AiCitationChecker, CiteMe,
GPTZero hallucination check, Paperpile's checker) uploads your text to their server,
and most require accounts and cap free usage. RefExists is **100% client-side**:
a static page, no accounts, no analytics, no server, no caps beyond the registries'
own public rate budgets. Court filings, unpublished manuscripts and misconduct-review
documents never leave your machine except as individual lookups to the public
registries — enforced by the page's Content-Security-Policy, not just promised.

## Honesty model

- A network failure is **never** reported as "not found" — absence verdicts require a
  definitive registry 404 (Crossref → DataCite → the doi.org handle system, which is
  authoritative for every DOI agency).
- "No record" is explicitly framed as a **lead, not a conviction** (books, theses,
  non-English and very recent works are under-indexed).
- Web-only references are "Can't check", never accused.
- "Verified" means the reference **exists and matches** — the page states plainly that
  it does not mean the source supports the claim it's cited for.
- Every verdict shows its evidence trail (which registries said what, with links).

## Run locally

```bash
python3 -m http.server 8471 --directory public
# open http://localhost:8471
```

No build step, no dependencies. The whole engine is [`public/verifier.js`](public/verifier.js).

## For AI agents — MCP server

The same engine ships as a **local, keyless MCP server** so an agent can verify its own
citations before it emits them (hallucinated citations are caused by LLMs — catch them in
the loop). All registry calls run on the user's machine; there is no hosted backend.

```bash
cd mcp && npm install
# then point Claude Desktop / Claude Code / Cursor at:  node /abs/path/mcp/server.js
```

Exposes a `verify_citations` tool. See [`mcp/README.md`](mcp/README.md).

## Test

```bash
node test/run-tests.mjs        # 25 live-API cases: pass, fail, honesty, adversarial
cd mcp && node test-client.mjs # end-to-end MCP protocol test
```

## Deploy

```bash
npx wrangler deploy       # assets-only Cloudflare Worker; see RUNBOOK.md
```

## Docs

- [DECISIONS.md](DECISIONS.md) — why this validator, this architecture, this design
- [NOTES.md](NOTES.md) — build log
- [VERIFICATION.md](VERIFICATION.md) — evidence the live deployment works
- [RUNBOOK.md](RUNBOOK.md) — operate, deploy, roll back, teardown

MIT licensed. Built on free public scholarly infrastructure; not affiliated with any registry.
