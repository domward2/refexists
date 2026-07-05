# LAUNCH.md — RefExists launch kit

The tool is live but has zero inbound. This is the distribution plan: what to post,
where, and how — plus the copy, ready to paste. **Distribution is the experiment.** If
these posts don't pull traffic, a paid tier wouldn't have either; if they do, that
traffic tells you which channel (MCP, API, extension) is worth building next.

---

## Positioning discipline (read before posting)

The research (4 streams) is blunt: the basic "does this reference exist" check is a
commodity — free clones exist (BibTeX Verifier, CiteTrue, Citely, CiteMe), and
Zotero/Crossmark already cover retraction. So:

1. **Lead on fabrication, not retraction.** Retraction is table stakes; catching
   *fabricated DOIs, AI-hallucinated references, and real-DOI-on-the-wrong-paper*
   is the hook.
2. **"Deterministic, not probabilistic."** Universities are being told to distrust
   AI-writing detectors. "This DOI resolves to nothing" is a *fact*, not an 87%
   guess. This line lands hardest with academics and lawyers.
3. **Privacy-first / client-side / no account / nothing uploaded.** The real
   differentiator. It's the reason court filings and unpublished manuscripts can use
   it. Say it plainly.
4. **Do NOT claim "first" or "nobody's done this."** Provably false; it will get
   torn apart in comments. Claim what's true: *free, no account, 100% in your
   browser, six registries incl. books, every verdict shows its evidence, open source.*
5. **Never overstate.** "Not indexed" ≠ "fabricated." Lead with the honesty model —
   it's a credibility asset, especially in academic/librarian rooms.

Etiquette: Reddit and HN punish blatant self-promo. Post as a maker sharing a free
tool and *why you built it*, engage in the comments, don't drop-and-run. One post per
community, not a blast.

---

## Channel 1 — Hacker News (Show HN)

Submit at https://news.ycombinator.com/submit. Title ≤ 80 chars, no hype.

**Title:**
> Show HN: RefExists – check if a paper's references actually exist (client-side)

**First comment (post immediately after, as the maker):**
> I built this after seeing the run of court sanctions and the NeurIPS 2025 finding
> where accepted papers contained hallucinated citations. It's a static page — paste a
> bibliography and your browser checks each reference directly against Crossref,
> DataCite, doi.org, OpenAlex, PubMed and Open Library. It flags fabricated DOIs,
> AI-hallucinated references, real DOIs stitched onto the wrong paper, and retracted
> work.
>
> Two design choices I'd call out: (1) there's no server — nothing is uploaded, because
> there's nothing to upload it to; the CSP only allows connections to those six
> registries. That's deliberate, so it's usable on unpublished manuscripts and filings.
> (2) It's honest about uncertainty — a network error is never reported as "not found",
> and "not indexed" is amber, not a red "fabricated" accusation. Only the two things it
> can *prove* (a confirmed-404 DOI, or a real DOI on the wrong paper) are red.
>
> It's not the first citation checker — the difference is it's free, needs no account,
> runs entirely in your browser, and the whole engine is one readable JS file. Source
> is MIT on GitHub. Happy to hear where it's wrong.

Best time: weekday 08:00–10:00 ET. Expect the honesty/privacy angle and the "how do you
handle non-DOI / books / non-English" questions — answer them straight (it's a known
limit).

---

## Channel 2 — Reddit

Post natively (text posts, not just a link). Read each sub's self-promo rule first;
some require a flair or a "I made this" disclosure.

- **r/AcademicIntegrity** — the bullseye. Frame: "Free tool to check students'/your own
  references aren't hallucinated — deterministic, no AI-detector guesswork."
- **r/AskAcademia**, **r/PhD**, **r/GradSchool** — frame around checking your own
  bibliography before submission.
- **r/Professors** — the grading-hallucinated-sources angle (deterministic > Turnitin
  AI guess).
- **r/Zotero** — narrower; note it complements Zotero (Zotero flags *retractions*; this
  flags *fabrications*). Don't overclaim.
- **r/LaTeX** — hold until the CLI/.bib path exists; then "check your .bib resolves."
- **r/libraries**, **r/AcademicLibrarians** — librarians build "spotting AI citations"
  guides; this is a tool for those guides.

**Reddit body (adapt per sub):**
> **I made a free tool that checks whether a paper's references actually exist —
> entirely in your browser.**
>
> Paste a reference list; it verifies each entry against Crossref, DataCite, doi.org,
> OpenAlex, PubMed and Open Library and flags fabricated DOIs, AI-hallucinated
> references, real DOIs attached to the wrong paper, and retracted work.
>
> Why it might be useful here: it's *deterministic* — it tells you "this DOI resolves to
> nothing," not "this looks 87% AI." Nothing is uploaded (no server, no account), so
> it's safe for unpublished work. And it's honest about limits — books/theses/very
> recent/non-English work are under-indexed, so it says "not indexed," never
> "fabricated," when it can't be sure.
>
> Live: https://refexists.dsl4.com · Source (MIT): https://github.com/domward2/refexists
>
> It is *not* the first citation checker and I'm not claiming it catches everything —
> would genuinely like to know where it fails on your references.

---

## Channel 3 — Academic Bluesky / Mastodon / X

Short, no thread-spam. Tag the academic communities.

**Bluesky / Mastodon (fediscience.org, scholar.social, hcommons.social):**
> Built a free tool: paste a bibliography and your browser checks whether every
> reference actually exists — fabricated DOIs, AI-hallucinated refs, real DOIs on the
> wrong paper, retractions. No account, nothing uploaded (it's a static page, no
> server). Deterministic, not an AI-detector guess.
> https://refexists.dsl4.com  #AcademicChatter #AcademicSky

**X (if used):** same, drop hashtags to one, add the OG card (auto-renders).

---

## Channel 4 — Librarian / integrity communities (outreach, not posts)

Higher-trust, slower, but the right audience:
- Scholarly Kitchen (comment / tip, don't spam).
- Academic-library listservs where you have standing (ILI-L, lita-l) — share as a
  resource, not an ad.
- University "AI & academic integrity" LibGuide maintainers — many list citation-check
  tools; email the maintainer with a one-liner. This earns durable backlinks.

---

## Channel 5 — when the MCP ships (the AI-dev launch)

This is the second, differentiated wave — post *after* the MCP is published:
- **r/mcp** and the MCP Discord.
- MCP registries/directories: **Smithery** (smithery.ai), **mcp.so**, **Glama**
  (glama.ai/mcp), **PulseMCP** (pulsemcp.com), and a PR to **punkpeye/awesome-mcp-servers**.
- Angle: "An MCP server that lets your agent verify its own citations before it emits
  them — keyless, fully local, catches fabricated DOIs + wrong-paper + retractions
  across journals *and* books. The only JS one." (Three Python ones exist — don't claim
  first; claim keyless-local-JS + books + retraction in one pass.)

---

## Metric to watch (the whole point)

You have no analytics by design. Turn on **Cloudflare's aggregate request count** (zero
code, no cookies, no personal data) so you can see whether any of this pulls traffic.
That number over the two weeks after launch is the signal that decides whether to build
anything else. No traffic → the idea, not the execution, is the ceiling. Real traffic →
the MCP and a paid institutional tier become worth the effort.
