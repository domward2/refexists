# DECISIONS.md — RefExists

## D1 — Validator target: hallucinated-citation checker (Candidate A)

Three candidates were researched (prior-art agent, 2026-07-05, live-verified claims):

| | A: Citation reality checker | B: Pre-share file privacy checker | C: Scam message red-flag checker |
|---|---|---|---|
| Harm severity | ~1,700 court cases w/ hallucinated citations; sanctions escalating (6th Cir. 2026); hallucinated refs in accepted NeurIPS 2025 papers | Real but diffuse (location/metadata leaks); no acute 2024–26 incident wave | Highest raw harm ($16B FTC 2025) |
| Differentiation | **Zero verified free/no-account/client-side entrants**; all competitors are server-side SaaS with caps (CiteSure 10/mo, AiCitationChecker 50 credits/day, GPTZero, Paperpile, CiteMe) | NoFileUpload.com already owns "client-side, free" per-format tools | Big-brand free tools (Bitdefender Scamio, Norton Genie, F-Secure) |
| False-confidence risk | Manageable: verdicts are registry-backed; "not found" ≠ "fake" is expressible | Low | **Dangerous**: heuristic "no red flags" on a real scam = active harm |
| Ship-today probability | High (all APIs live-verified CORS-open, keyless) | High | High |

**Chosen: A.** C was rejected primarily on safety axis 4 (a false "looks clean" on a
scam message is worse than no tool); B on differentiation. A's failure modes are
controllable because every verdict is backed by a named registry response.

## D2 — Architecture: 100% client-side static page

- The differentiation *is* the architecture: court filings, unpublished manuscripts and
  misconduct-review documents are exactly the texts you don't paste into a SaaS.
- No server, no accounts, no analytics, no storage → mission's privacy-first rule
  satisfied by construction, and enforceable via CSP (connect-src allows only the six registries).
- Cost: $0 (Workers free tier; registries are public infrastructure).

## D3 — Registry stack & verdict ladder

- DOI path: Crossref → DataCite → doi.org handle API (authoritative existence for ALL
  registration agencies — a DOI absent there is definitively unregistered).
- arXiv IDs resolved via their DataCite DOIs (10.48550/arXiv.*) because export.arxiv.org
  has no CORS (live-verified).
- Retraction flags from OpenAlex `is_retracted` (verified against Wakefield 1998).
- **A network error is never a verdict** (STATUS.ERROR ≠ NOT_FOUND). Absence verdicts
  require a definitive registry 404 / handle responseCode ≠ 1.
- Web-URL references that can't be matched → "Can't check", never "No record"
  (browsers cannot fetch arbitrary sites; accusing them would be false confidence).

## D4 — OpenAlex usage kept to fallback-only

OpenAlex's Feb-2026 keyless budget ≈ $0.10/day/IP (~100 searches). It is only queried
when Crossref's best match is weak, and per-user (their IP), so the budget is per-visitor.
No shared API key is embedded (would be abusable + against ToS spirit).

## D5 — Naming: RefExists (working repo name "ghostcite" is historical)

- "CiteCheck" (collides; legal-tech genericised), "RefCheck" (heavily collided),
  "CiteSure" (taken), "RealCite"/"GhostCite" (.coms registered) all rejected.
- refexists.com RDAP-404 (unregistered) on 2026-07-05; name honestly states the core
  claim the tool can actually prove.

## D6 — Deploy: assets-only Cloudflare Worker + custom domain

- `wrangler deploy` with `assets` and `routes[{pattern: refexists.dsl4.com, custom_domain: true}]`
  creates exactly one DNS record and cannot touch apex/www (hard rule: protect dsl4.com).
- Pages was the alternative; Workers assets chosen because custom-domain attach is
  atomic with the deploy and needs no dashboard steps.

## D7 — Design: "card catalogue" direction

Four directions considered (card catalogue/stamps; forensic terminal; editorial
broadsheet; Swiss registry). Card catalogue chosen: the metaphor is the mechanic
(does this exist in the catalogue? → stamped verdict), warm/trustworthy for the
academic+legal audience, and maximally distinct from competitor SaaS chrome.
Fonts self-hosted (Fraunces + IBM Plex Mono) — no Google Fonts CDN call, because a
privacy tool must not leak visitor IPs to a third party for typography.

## D8 — Known artifact: Cloudflare Bot Fight Mode script injection

The zone injects a `/cdn-cgi/challenge-platform` inline script into served HTML.
Our CSP (`script-src 'self'`) blocks it (one console violation, no functional or
privacy impact — the block is the policy working). Disabling would require zone-level
setting changes, which are out of bounds under the protect-dsl4.com rule. Accepted.
