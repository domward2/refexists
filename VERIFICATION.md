# VERIFICATION.md — RefExists

All evidence gathered 2026-07-05. Commands and their real outputs.

## 1. Live deployment is up and public

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://refexists.dsl4.com
200
```
Response carries the hardened security headers (from `_headers`):
```
content-security-policy: default-src 'self'; connect-src https://api.crossref.org
  https://api.datacite.org https://doi.org https://api.openalex.org
  https://eutils.ncbi.nlm.nih.gov https://openlibrary.org; ... object-src 'none'; frame-ancestors 'none'
x-content-type-options: nosniff
referrer-policy: no-referrer
permissions-policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
cross-origin-opener-policy: same-origin
```

## 2. The live code is the code that was tested (not theatre)

```
$ curl -sS https://refexists.dsl4.com/verifier.js | diff - public/verifier.js   → IDENTICAL
$ curl -sS https://refexists.dsl4.com/app.js     | diff - public/app.js         → IDENTICAL
```
`index.html` differs only by Cloudflare's edge-injected challenge/beacon script,
which the page's own `script-src 'self'` CSP blocks (confirmed in the browser
console: two CSP-violation lines for `cloudflareinsights.com`, nothing loads).

The 25-case test suite, re-run against the **live-downloaded** `verifier.js`:
```
==== 25 passed, 0 failed ====
```

## 3. The live validator catches real problems (demonstrated in-browser, not hard-coded)

Two independent live runs through the deployed site (headless Chromium driving the
real page; the example button only fills the textarea — every verdict is a live
registry lookup):

**Ad-hoc paste (author fabrication + fabricated reference):**
| Input | Live verdict |
|---|---|
| `Fakeson, Q., & Notreal, Z. (1925). Molecular structure of nucleic acids… https://doi.org/10.1038/171737a0` (real DOI, fabricated authors + year) | **Check me** — "the identifier resolves to a real work whose title matches — but the year… conflicts and the author could not be confirmed" |
| `Doe, A. (2019). The neural correlates of imaginary breakfast decisions…` (fabricated) | **Not indexed** |

**Worked example (8 references, one live run):**
```
8 references checked · 2 check out · 2 need a human look · 3 suspect (1 retracted) · 1 couldn't be checked
REF 01 Watson & Crick 1953 (real DOI+meta)        → Verified   (Crossref ✓, OpenAlex ✓ no retraction)
REF 02 Vaswani 2017 (no id, real paper)           → Match found (Crossref search, author-corroborated)
REF 03 maize genomics + fabricated DOI            → Not found   (Crossref ✗, DataCite ✗, doi.org handle ✗)
REF 04 real DOI on wrong paper (LLM stitch)       → Mismatch    (compare block: cited vs registry)
REF 05 Wakefield 1998                             → Retracted   (OpenAlex ⚑, red banner + Retraction Watch link)
REF 06 fabricated "imaginary breakfast decisions" → Not indexed (amber, no false red accusation)
REF 07 Kahneman book (no id)                       → Check me    (Open Library, compare shown)
REF 08 BBC News URL                                → Can't check (non-scholarly web content)
```
Earlier separate probe also confirmed a **typo'd DOI** (`171737b0` for `…a0`) on an
otherwise-correct citation → **Check me: "you have most likely mistyped the DOI"**,
not a red "Not found".

## 4. Pass and fail cases both proven

- PASS: real DOI+metadata → Verified; real no-id paper → Match found; arXiv id → Verified; real book → Check me/Match.
- FAIL/FLAG: fabricated DOI → Not found; wrong-paper DOI → Mismatch; retracted → Retracted; fabricated no-id ref → Not indexed; fabricated arXiv id → Not found.
- HONESTY: web-only → Can't check (never accused); registry error → Retry (never "not found").

## 5. False-confidence controls (verified by the 25-case suite + adversarial pass)

- A network/API failure never becomes an absence verdict (ERROR ≠ NOT_FOUND) — enforced structurally.
- "Verified"/"Match found" (green) require author **or** year corroboration — a real DOI on fabricated authors/year is downgraded to "Check me" (test C1/C1b/C3).
- Absence with no identifier is amber "Not indexed", not a red fabrication accusation (only confirmed-404 DOIs and wrong-work DOIs are red).
- Angle-bracket-wrapped DOIs no longer red-flag real papers (test C2).

## 6. dsl4.com root is safe — before and after

| Check | Baseline (11:45 UTC) | After all deploys |
|---|---|---|
| `curl https://dsl4.com` | 302 → `dsl4.cloudflareaccess.com/...` | **302 → `dsl4.cloudflareaccess.com/...`** (identical) |
| `curl https://www.dsl4.com` | 302 | **302** (identical) |
| `dig +short dsl4.com A` | 172.67.204.217, 104.21.77.59 | **172.67.204.217, 104.21.77.59** (unchanged) |

## 7. DNS changes — only the minimum new subdomain record

```
$ dig +short refexists.dsl4.com A  →  172.67.204.217  104.21.77.59
```
Exactly one record was added: the Cloudflare **Workers custom-domain** record for
`refexists.dsl4.com` (created automatically by `wrangler deploy` via the
`routes: [{ pattern: "refexists.dsl4.com", custom_domain: true }]` config). It
resolves to the zone's shared Cloudflare anycast IPs and is routed by Host header.
No apex record, no `www` record, and no other zone setting was created or modified.
`dsl4.com` and `www.dsl4.com` are byte-for-byte unchanged (section 6).

## 8. Cost

$0. Cloudflare Workers free tier serves static assets; all six registries are free
public infrastructure with per-visitor rate budgets. No metered API is called.
