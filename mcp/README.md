# refexists-mcp

A **local, keyless MCP server** that lets an AI agent verify its own citations
*before it emits them*. It wraps the same dependency-free engine as
[refexists.dsl4.com](https://refexists.dsl4.com): every reference is checked against
Crossref, DataCite, doi.org, OpenAlex, PubMed and Open Library, catching **fabricated
DOIs, AI-hallucinated references, a real DOI attached to the wrong paper, and retracted
work**.

Why an MCP: hallucinated citations are *caused by* LLMs, so the highest-leverage place
to catch one is inside the agent's own loop. This server gives the agent a `verify_citations`
tool it can call on any reference it's about to present.

**All registry calls run on your machine.** There is no hosted backend — nothing is sent
anywhere but the six public registries, exactly like the website.

## Tool

### `verify_citations`
- **Input:** `text` — one reference, or a whole bibliography (numbered `[1]`, one-per-line,
  or blank-line-separated blocks). DOIs, arXiv IDs and PMIDs are detected automatically.
- **Returns:** a per-reference verdict plus a structured summary:
  - `verified` / `likely_real` / `exists` — checks out
  - `check` / `not_indexed` / `uncheckable` — needs a human look
  - `mismatch` / `not_found` — provably suspect (real DOI on the wrong paper; or a
    definitively unregistered identifier)
  - `retracted` — real but retracted
  - `error` — a registry was unreachable (**not** a verdict; retry)
- Each reference includes the matched registry record, a confidence score, the advice,
  and which registries were consulted. The response also has `any_suspect` so the agent
  can gate on it.

## Honesty model

- A network error is **never** reported as "not found". Absence verdicts require a
  definitive registry 404.
- `not_indexed` is **not** proof of fabrication — books, theses, non-English and very
  recent work are under-indexed. Only `not_found` and `mismatch` are things the tool can
  *prove*.
- It does **not** check that a real paper supports the claim it's cited for, and does not
  cover legal/case-law citations.

## Install (local stdio)

Requires Node ≥ 18.

```bash
git clone https://github.com/domward2/refexists
cd refexists/mcp
npm install
```

Then point your MCP client at it.

**Claude Desktop / Claude Code** (`claude_desktop_config.json` or `.mcp.json`):
```json
{
  "mcpServers": {
    "refexists": {
      "command": "node",
      "args": ["/absolute/path/to/refexists/mcp/server.js"]
    }
  }
}
```

**Cursor / VS Code / other MCP clients:** same command/args pair.

Restart the client; the agent will have a `verify_citations` tool. Ask it to "verify
these references" or instruct it to self-check citations before answering.

## Notes

- Keyless. It uses each registry's free public API from your machine (Crossref polite
  pool, OpenAlex per-IP budget, PubMed keyless tier). Very large bibliographies may hit a
  registry's rate limit — the engine retries and reports `error` (retry), never a false
  "not found".
- MIT licensed. Part of [RefExists](https://github.com/domward2/refexists).
