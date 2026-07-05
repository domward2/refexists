# NOTES.md — RefExists build log (2026-07-05)

## What this is
Free, open, client-side citation reality-checker at **https://refexists.dsl4.com**.
Paste a bibliography → browser verifies each reference against Crossref, DataCite,
doi.org, OpenAlex, PubMed, Open Library → stamped verdicts with evidence trails.
Catches: fabricated DOIs, AI-hallucinated references, real identifiers stitched onto
the wrong work, retracted papers cited as valid.

## Timeline
1. Recon: dsl4.com baseline recorded (302 → Cloudflare Access; zone on account ac8ede1a…).
   wrangler 4.107.0 authed via npx (pages/workers/routes write, zone read).
2. Live CORS verification of all candidate registries (curl with Origin header) —
   architecture confirmed feasible before committing to the target.
3. Prior-art research subagent (3 candidates × landscape) → DECISIONS.md D1.
4. Engine (`public/verifier.js`, zero deps, browser+Node) + 16-case live test suite.
5. UI: card-catalogue design direction (DECISIONS.md D7), self-hosted fonts, strict CSP.
6. Local browser QA via preview server: worked example → 8/8 correct live verdicts,
   zero console errors, horizontal-overflow bug found & fixed (min-width on evidence rows).
7. Deploy: assets-only Worker + custom domain. dsl4.com re-verified unchanged.
8. Live-integrity proof: live-served verifier.js/app.js byte-identical to tested files;
   test suite re-run against the live-downloaded engine → 16/16.
9. Adversarial review subagent (5 attack axes) → fixes below.
10. Docs, license, final verification sweep (VERIFICATION.md).

## Environment quirks encountered
- Session runs inside a Dexter worktree with a write-guard hook: project built at
  `<worktree>/ghostcite-build/` (locally git-excluded from Dexter), mirrored to
  `~/Code/refexists` at the end via rsync. Nested git repo holds real history.
- Chrome-extension MCP was down; live-site behavioral proof achieved via
  byte-diff (live vs tested files) + suite run against live-downloaded engine,
  plus full browser QA on identical code via localhost preview.
- Cloudflare Bot Fight Mode injects a script into live HTML; our CSP blocks it
  (accepted artifact, DECISIONS.md D8).

## Design-tooling note (craft brief)
Used the `frontend-design` skill for the build pass and preview-tool QA
(screenshot/inspect/resize) for the review pass. Figma/shadcn/21st-dev MCPs were
available but wrong-shaped for a zero-dependency static page (component libraries
would have imported a JS framework this tool deliberately doesn't have).
Four design directions were proposed and one chosen (DECISIONS.md D7).

## Ideas explicitly deferred (scope discipline)
- BibTeX/RIS structured input parsing (worth doing; segmentation currently plain-text).
- Case-law checking via CourtListener API (different registry universe; linked in Limits instead).
- Batch DOI export / corrected-BibTeX output.
- PWA/offline shell (pointless — the registries are the product).
- GitHub public mirror of this repo (repo is self-contained; do when Dom wants the
  public "open source" link to point somewhere).
