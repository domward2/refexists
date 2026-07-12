# LAUNCH-FINAL.md — Show HN, finalized

The finished, single-source Show HN post: title, body, first-comment FAQ, and
alternates. `LAUNCH.md` still has the full distribution plan (Reddit, academic
Bluesky/Mastodon, librarian outreach, the later MCP-specific wave) — post this
one first, then work down that list.

Every claim below was checked against the live code (`public/verifier.js`,
`public/_headers`, `mcp/server.js`, `mcp/README.md`) before writing, not just
against the marketing copy. Specifically: `public/_headers` sets a CSP with
`connect-src` restricted to exactly six hosts (api.crossref.org,
api.datacite.org, doi.org, api.openalex.org, eutils.ncbi.nlm.nih.gov,
openlibrary.org) and `script-src 'self'` / `default-src 'self'` — there is no
first-party or third-party analytics or logging endpoint in the CSP allowlist,
and grepping `verifier.js` for outbound calls turns up exactly those six
registry hosts and nothing else.

---

## Show HN title (74 chars)

```
Show HN: RefExists – catch fabricated DOIs and AI-hallucinated citations
```

Submit at: https://news.ycombinator.com/submit
URL: `https://refexists.dsl4.com`

Best time: weekday 08:00-10:00 ET.

---

## Body post

```
I built this after the run of court sanctions for AI-hallucinated citations
in legal filings, and the finding that some accepted NeurIPS 2025 papers
contained fabricated references. Paste a bibliography and your browser
checks every reference directly against Crossref, DataCite, doi.org,
OpenAlex, PubMed and Open Library — no upload, because there's nowhere to
upload it to.

The problem it's aimed at: retraction checking is already solved (Zotero,
Crossmark). Fabrication isn't. An LLM doesn't just cite retracted papers —
it invents DOIs that were never issued, or takes a real DOI and staples it
to the wrong paper's title and authors. That second failure mode is the
distinctive LLM signature, and it's the one existing tools mostly don't
check for.

How it verifies: DOIs are resolved through Crossref, then DataCite, then the
doi.org handle system (authoritative for every registration agency — a DOI
absent there is definitively unregistered, not just "not indexed by this one
database"). If a DOI resolves but the registered title/authors don't match
what was cited, that's flagged as a mismatch — the real-DOI-wrong-paper
case. OpenAlex adds retraction status and a fallback fuzzy match when there's
no DOI at all. Every verdict shows which registries were checked and what
they returned, so you're not asked to trust a black box.

It's a static page — no server, no accounts, no analytics, no logs. The
site's Content-Security-Policy hard-blocks any connection except to those
six registries, so this isn't a promise, it's enforced by the browser. That
matters for court filings and unpublished manuscripts, which are exactly the
texts you don't want to paste into a SaaS tool.

MCP server for agents: the same engine ships as a local, keyless MCP server
(`mcp/`), so an agent can call a `verify_citations` tool on its own output
before it presents a reference to a user — catching the hallucination at the
source that causes most of them. Same no-hosted-backend property: every
registry call runs from your machine, nothing routes through me.

It's free. No account, no tier, no cap beyond the registries' own public
rate limits. Source is MIT: https://github.com/domward2/refexists

Honest limits: books, theses, non-English and very recent work are
under-indexed across these registries, so an unmatched reference is reported
as "not indexed," never "fabricated" — those are different claims and only
one of them is something the tool can prove. It doesn't check that a cited
source actually supports the claim it's attached to, and it doesn't cover
legal/case-law citations. It's not the first citation checker to exist —
what's different is free, no account, runs entirely in your browser, and the
whole engine is one readable file. Where it gets something wrong, I'd
genuinely like to know.
```

---

## First-comment FAQ (post immediately after submitting)

```
Anticipating a few questions:

1. Is this really 100% client-side — what's actually sent where?
Yes, and it's enforced, not just claimed. There's no backend at all; the
site is static assets on a Cloudflare Worker. The page's CSP sets
connect-src to exactly six hostnames — the registries themselves — so the
browser will refuse to make any other network request from that page, AI
tracking pixel or otherwise. What leaves your machine per reference is a
handful of read-only GET/lookup requests to Crossref/DataCite/doi.org/
OpenAlex/PubMed/Open Library, the same requests you'd make by hand. Nothing
is stored, logged, or sent to me.

2. How is this different from Zotero or a plagiarism/AI-detector tool?
Different claims entirely. Zotero and Crossmark already flag retractions
well — RefExists doesn't try to compete there. What it adds is fabrication
detection: a DOI that was never issued, or a real DOI stapled onto the wrong
paper's metadata. And unlike an AI-writing detector, every verdict is
deterministic — "this DOI resolves to nothing" is a registry fact, not a
probability score.

3. What about books, non-English papers, or things published last month?
Under-indexed across all six registries, so those come back "not indexed" —
explicitly not the same verdict as "fabricated." The tool only shows a
suspect verdict (mismatch/not-found) when it has a definitive registry
answer to point to. If it can't get a definitive answer, it says so instead
of guessing.

4. Is the MCP server also fully local, or does it call out to your infra?
Fully local — same property as the website. It's a keyless stdio MCP server;
`node mcp/server.js` runs on your machine, wraps the identical verification
engine, and every registry call originates from your machine. There's no
hosted backend behind it at all — I don't see your citations or your agent's
traffic.

5. Is there a business model, or is this free forever?
It's free today, MIT-licensed, and there's no paid tier live. The honest
answer on what's next: I'm watching Cloudflare's aggregate (cookie-less,
no-PII) request count to see whether this pulls real traffic. If it doesn't,
that's the answer on whether to build more. If it does, an MCP registry
listing and possibly a paid institutional tier become worth the effort — but
nothing beyond what's already shipped is committed.
```

---

## Alternate titles

1. `Show HN: RefExists – a client-side checker for fabricated citations` (69 chars)
   — leads with the privacy/architecture angle instead of the fabrication
   hook; better fit if the thread context is more about client-side tooling.

2. `Show HN: RefExists, a browser-only fabricated-citation checker + MCP server` (75 chars)
   — surfaces the MCP server up front for a more developer/agent-tooling
   audience; save for the Channel 5 "AI-dev launch" wave once the MCP is the
   headline, per LAUNCH.md's staged-launch plan.
