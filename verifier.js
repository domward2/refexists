/*
 * verifier.js — core citation verification engine.
 * Pure ES module, runs in browser and Node (both have global fetch).
 * No dependencies, no keys, no server: talks directly to free scholarly
 * registries (Crossref, DataCite, doi.org handle system, OpenAlex,
 * PubMed E-utilities, Open Library), all CORS-enabled.
 *
 * Design rule #1 (false-confidence control): a network/API failure is
 * NEVER reported as "not found". Absence verdicts require a definitive
 * negative from the registry (HTTP 404 / handle responseCode 100).
 */

const MAILTO = 'ghostcite@dsl4.com';
const FETCH_TIMEOUT_MS = 12000;
const MAX_REFS = 100;

// ---------------------------------------------------------------------------
// Text normalisation & similarity
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'to', 'with', 'at',
  'by', 'from', 'is', 'are', 'as', 'its', 'be', 'was', 'were', 'do', 'does',
  'not', 'no', 'via', 'into', 'toward', 'towards', 'using', 'based', 'de',
  'la', 'el', 'les', 'des', 'und', 'der', 'die', 'das',
]);

export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(s) {
  return normalize(s)
    .split(' ')
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Fraction of the candidate title's significant tokens that appear in the
 * reference text. Robust to the citation containing extra material (authors,
 * journal, pages) around the title.
 */
export function titleContainment(candidateTitle, refText) {
  const titleTokens = significantTokens(candidateTitle);
  if (titleTokens.length === 0) return 0;
  const refTokens = new Set(normalize(refText).split(' '));
  let hit = 0;
  for (const t of titleTokens) if (refTokens.has(t)) hit++;
  const frac = hit / titleTokens.length;
  // Very short titles ("Nature", "Attention") match too easily — demand all tokens.
  if (titleTokens.length < 3) return frac === 1 ? 0.9 : frac * 0.5;
  return frac;
}

// ---------------------------------------------------------------------------
// Reference segmentation
// ---------------------------------------------------------------------------

const NUMBERED_RE = /^\s*(?:\[\d{1,3}\]|\d{1,3}[.)])\s+/;

export function splitReferences(text) {
  const t = (text || '').replace(/ /g, ' ').trim();
  if (!t) return [];

  const lines = t.split(/\r?\n/);
  const numberedCount = lines.filter((l) => NUMBERED_RE.test(l)).length;

  let refs = [];
  if (numberedCount >= 2) {
    // Numbered list: a new ref starts at each marker; other lines are wraps.
    let cur = null;
    for (const line of lines) {
      if (NUMBERED_RE.test(line)) {
        if (cur) refs.push(cur);
        cur = line.replace(NUMBERED_RE, '').trim();
      } else if (cur !== null && line.trim()) {
        cur += ' ' + line.trim();
      } else if (line.trim()) {
        refs.push(line.trim()); // preamble before first marker
      }
    }
    if (cur) refs.push(cur);
  } else {
    const blocks = t.split(/\n\s*\n/).map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    if (blocks.length >= 2) {
      refs = blocks;
    } else {
      // Single block: one ref per line, folding short continuation lines in.
      const nonblank = lines.map((l) => l.trim()).filter(Boolean);
      if (nonblank.length >= 2) {
        for (const line of nonblank) {
          const startsLower = /^[a-z]/.test(line);
          if (refs.length && (startsLower || line.split(/\s+/).length < 4)) {
            refs[refs.length - 1] += ' ' + line;
          } else {
            refs.push(line);
          }
        }
      } else {
        refs = [t.replace(/\s*\n\s*/g, ' ').trim()];
      }
    }
  }

  return refs
    .map((r) => r.trim())
    .filter((r) => r.length >= 15 && /[a-zA-Z]/.test(r))
    .slice(0, MAX_REFS);
}

// ---------------------------------------------------------------------------
// Identifier & metadata extraction
// ---------------------------------------------------------------------------

const DOI_RE = /\b10\.\d{4,9}\/[-._;()<>\/:A-Za-z0-9]+/g;
const ARXIV_NEW_RE = /arxiv[:\s/]*(\d{4}\.\d{4,5})(v\d+)?/i;
const ARXIV_OLD_RE = /arxiv[:\s/]*([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?/i;
const PMID_RE = /\bPMID[:\s]*(\d{4,9})/i;

function cleanDoi(doi) {
  let d = doi.replace(/[.,;:!?]+$/, '');
  // Strip a trailing ')' only when unbalanced — DOIs like
  // 10.1016/S0140-6736(97)11096-0 legitimately contain parentheses.
  while (d.endsWith(')') && (d.match(/\(/g) || []).length < (d.match(/\)/g) || []).length) {
    d = d.slice(0, -1).replace(/[.,;:!?]+$/, '');
  }
  return d;
}

export function extractIdentifiers(ref) {
  const ids = {};
  const doiMatches = ref.match(DOI_RE);
  if (doiMatches) ids.doi = cleanDoi(doiMatches[0]);
  const ax = ref.match(ARXIV_NEW_RE) || ref.match(ARXIV_OLD_RE);
  if (ax) ids.arxiv = ax[1];
  const pm = ref.match(PMID_RE);
  if (pm) ids.pmid = pm[1];
  const urls = ref.match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  ids.urls = urls.filter((u) => !/doi\.org|arxiv\.org|pubmed|ncbi\.nlm/i.test(u));
  return ids;
}

export function extractMeta(ref) {
  const meta = {};
  const quoted = ref.match(/[“"']([^”"']{15,300})[”"']/);
  if (quoted) meta.quotedTitle = quoted[1];
  const years = [...ref.matchAll(/\b(19[5-9]\d|20[0-4]\d)[a-z]?\b/g)].map((m) => parseInt(m[1], 10));
  if (years.length) meta.year = years[0];
  const isBookish = /\b(Press|Publishing|Publishers|Books|Wiley|Springer|Routledge|Penguin|HarperCollins|Random House|edition|ed\.\)|eds?\.)\b/i.test(ref)
    && !/\bjournal\b/i.test(ref);
  meta.bookish = isBookish;
  return meta;
}

// ---------------------------------------------------------------------------
// Registry clients (each returns {found, work?, error?})
//   work = { title, authors: [family,...], year, doi?, url, source, container? }
// ---------------------------------------------------------------------------

async function timedFetch(url, opts = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;
  try {
    return await fetch(url, { ...opts, signal: ctrl?.signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** One retry on network error or 429/5xx; definitive 404s return immediately. */
async function fetchJson(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await timedFetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 404) return { status: 404 };
      if (res.ok) return { status: res.status, json: await res.json() };
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return { error: `HTTP ${res.status}` };
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return { error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network error') };
    }
  }
  return { error: 'unreachable' };
}

function crossrefWorkToRecord(msg) {
  return {
    source: 'Crossref',
    title: Array.isArray(msg.title) ? msg.title[0] : msg.title,
    authors: (msg.author || []).map((a) => a.family || a.name).filter(Boolean),
    year: msg.issued?.['date-parts']?.[0]?.[0] ?? msg.created?.['date-parts']?.[0]?.[0],
    doi: msg.DOI,
    container: Array.isArray(msg['container-title']) ? msg['container-title'][0] : msg['container-title'],
    url: msg.DOI ? `https://doi.org/${msg.DOI}` : undefined,
  };
}

async function crossrefByDoi(doi) {
  const r = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${MAILTO}`);
  if (r.error) return { error: r.error };
  if (r.status === 404) return { found: false };
  return { found: true, work: crossrefWorkToRecord(r.json.message) };
}

async function dataciteByDoi(doi) {
  const r = await fetchJson(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`);
  if (r.error) return { error: r.error };
  if (r.status === 404) return { found: false };
  const a = r.json?.data?.attributes || {};
  return {
    found: true,
    work: {
      source: 'DataCite',
      title: a.titles?.[0]?.title,
      authors: (a.creators || []).map((c) => c.familyName || c.name).filter(Boolean),
      year: a.publicationYear,
      doi: a.doi,
      container: a.publisher,
      url: a.doi ? `https://doi.org/${a.doi}` : undefined,
    },
  };
}

/** Authoritative existence check across ALL DOI registration agencies. */
async function doiHandleExists(doi) {
  const r = await fetchJson(`https://doi.org/api/handles/${encodeURIComponent(doi)}?type=URL`);
  if (r.error) return { error: r.error };
  if (r.status === 404) return { found: false };
  return { found: r.json?.responseCode === 1 };
}

async function openAlexByDoi(doi) {
  const r = await fetchJson(
    `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=id,title,is_retracted,publication_year,cited_by_count`
  );
  if (r.error || r.status === 404) return { found: false };
  return { found: true, retracted: !!r.json.is_retracted, citedBy: r.json.cited_by_count, oaId: r.json.id };
}

async function crossrefSearch(refText) {
  const q = encodeURIComponent(refText.slice(0, 400));
  const r = await fetchJson(
    `https://api.crossref.org/works?query.bibliographic=${q}&rows=5&select=DOI,title,author,issued,container-title`
  );
  if (r.error) return { error: r.error };
  return { found: true, works: (r.json?.message?.items || []).map(crossrefWorkToRecord) };
}

async function openAlexSearch(refText) {
  // OpenAlex search chokes on very long strings & punctuation — send tokens.
  const q = encodeURIComponent(significantTokens(refText).slice(0, 20).join(' '));
  const r = await fetchJson(
    `https://api.openalex.org/works?search=${q}&per-page=5&select=title,display_name,authorships,publication_year,doi,is_retracted`
  );
  if (r.error) return { error: r.error };
  const works = (r.json?.results || []).map((w) => ({
    source: 'OpenAlex',
    title: w.title || w.display_name,
    authors: (w.authorships || []).map((a) => (a.author?.display_name || '').split(' ').pop()).filter(Boolean),
    year: w.publication_year,
    doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, '') : undefined,
    url: w.doi,
    retracted: !!w.is_retracted,
  }));
  return { found: true, works };
}

async function openLibrarySearch(refText) {
  const q = encodeURIComponent(significantTokens(refText).slice(0, 12).join(' '));
  const r = await fetchJson(`https://openlibrary.org/search.json?q=${q}&limit=5&fields=title,author_name,first_publish_year,key`);
  if (r.error) return { error: r.error };
  const works = (r.json?.docs || []).map((d) => ({
    source: 'Open Library',
    title: d.title,
    authors: (d.author_name || []).map((n) => n.split(' ').pop()),
    year: d.first_publish_year,
    url: d.key ? `https://openlibrary.org${d.key}` : undefined,
  }));
  return { found: true, works };
}

async function pubmedById(pmid) {
  const r = await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`);
  if (r.error) return { error: r.error };
  const rec = r.json?.result?.[pmid];
  if (!rec || rec.error) return { found: false };
  return {
    found: true,
    work: {
      source: 'PubMed',
      title: rec.title,
      authors: (rec.authors || []).map((a) => (a.name || '').split(' ')[0]),
      year: parseInt((rec.pubdate || '').slice(0, 4), 10) || undefined,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      doi: (rec.articleids || []).find((x) => x.idtype === 'doi')?.value,
    },
  };
}

// ---------------------------------------------------------------------------
// Scoring: does this registry record match what the citation claims?
// ---------------------------------------------------------------------------

export function scoreMatch(work, refText, refMeta) {
  if (!work?.title) return { score: 0, parts: {} };
  const containment = titleContainment(work.title, refText);
  const refNorm = normalize(refText);
  const firstAuthor = work.authors?.[0] ? normalize(work.authors[0]) : '';
  const authorHit = firstAuthor && firstAuthor.length > 2 && refNorm.includes(firstAuthor) ? 1 : 0;
  let yearHit = 0;
  if (work.year && refMeta?.year) {
    const d = Math.abs(work.year - refMeta.year);
    yearHit = d === 0 ? 1 : d === 1 ? 0.5 : 0;
  } else if (work.year && !refMeta?.year) {
    yearHit = 0.5; // citation gave no year — don't punish
  }
  const score = containment * 0.7 + authorHit * 0.15 + yearHit * 0.15;
  return { score, parts: { containment, authorHit, yearHit } };
}

function pickBest(works, refText, refMeta) {
  let best = null;
  for (const w of works || []) {
    const s = scoreMatch(w, refText, refMeta);
    if (!best || s.score > best.scored.score) best = { work: w, scored: s };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Per-reference verification
// ---------------------------------------------------------------------------

export const STATUS = {
  VERIFIED: 'verified',            // identifier resolves AND metadata matches
  LIKELY: 'likely',                // no identifier; strong registry match found
  PARTIAL: 'partial',              // record found but only partially matches — human check
  MISMATCH: 'mismatch',            // DOI/PMID is real but belongs to a DIFFERENT work
  NOT_FOUND: 'not_found',          // identifier definitively absent from registries
  NO_MATCH: 'no_match',            // no identifier; nothing close in 250M+ records
  DOI_ONLY: 'doi_only',            // bare identifier, nothing to compare against
  UNVERIFIED_RA: 'unverified_ra',  // DOI exists at another agency; metadata unavailable
  UNCHECKABLE: 'uncheckable',      // web page / no scholarly identifier possible
  ERROR: 'error',                  // registry unreachable — NOT a verdict
};

/** How many significant tokens beyond the identifier itself the ref carries. */
function substanceBeyondIds(refText, ids) {
  let t = refText;
  if (ids.doi) t = t.split(ids.doi).join(' ');
  t = t.replace(/https?:\/\/[^\s]+/g, ' ').replace(/\bdoi\b|\barxiv\b|\bpmid\b/gi, ' ');
  return significantTokens(t).length;
}

function grade(result, work, refText, meta, substance) {
  result.found = work;
  if (substance < 4) return { ...result, status: STATUS.DOI_ONLY, confidence: 1 };
  const scored = scoreMatch(work, refText, meta);
  result.confidence = scored.score;
  result.scoreParts = scored.parts;
  if (scored.score >= 0.6) return { ...result, status: STATUS.VERIFIED };
  if (scored.score <= 0.3) return { ...result, status: STATUS.MISMATCH };
  return { ...result, status: STATUS.PARTIAL };
}

export async function verifyReference(refText) {
  const ids = extractIdentifiers(refText);
  const meta = extractMeta(refText);
  const checks = [];
  const result = { raw: refText, ids, meta, checks, retracted: false };

  const substance = substanceBeyondIds(refText, ids);

  // --- Path 1: DOI ---------------------------------------------------------
  if (ids.doi) {
    const cr = await crossrefByDoi(ids.doi);
    checks.push({ source: 'Crossref', kind: 'doi-lookup', outcome: cr.error ? 'error' : cr.found ? 'found' : 'absent', detail: cr.error });
    let work = cr.found ? cr.work : null;

    if (!work && !cr.error) {
      const dc = await dataciteByDoi(ids.doi);
      checks.push({ source: 'DataCite', kind: 'doi-lookup', outcome: dc.error ? 'error' : dc.found ? 'found' : 'absent', detail: dc.error });
      if (dc.found) {
        work = dc.work;
      } else if (dc.error) {
        return { ...result, status: STATUS.ERROR };
      } else {
        const h = await doiHandleExists(ids.doi);
        checks.push({ source: 'doi.org handle registry', kind: 'existence', outcome: h.error ? 'error' : h.found ? 'found' : 'absent', detail: h.error });
        if (h.error) return { ...result, status: STATUS.ERROR };
        if (h.found) return { ...result, status: STATUS.UNVERIFIED_RA };
        return { ...result, status: STATUS.NOT_FOUND };
      }
    }
    if (!work) return { ...result, status: STATUS.ERROR };

    // Retraction check (best-effort enrichment; failure is non-fatal)
    const oa = await openAlexByDoi(ids.doi);
    if (oa.found) {
      result.retracted = oa.retracted;
      result.citedBy = oa.citedBy;
      checks.push({ source: 'OpenAlex', kind: 'retraction-check', outcome: oa.retracted ? 'retracted' : 'clear' });
    }

    return grade(result, work, refText, meta, substance);
  }

  // --- Path 2: arXiv --------------------------------------------------------
  if (ids.arxiv) {
    const doi = `10.48550/arXiv.${ids.arxiv}`;
    const dc = await dataciteByDoi(doi);
    checks.push({ source: 'DataCite (arXiv)', kind: 'id-lookup', outcome: dc.error ? 'error' : dc.found ? 'found' : 'absent', detail: dc.error });
    if (dc.error) return { ...result, status: STATUS.ERROR };
    if (!dc.found) return { ...result, status: STATUS.NOT_FOUND };
    return grade(result, dc.work, refText, meta, substance);
  }

  // --- Path 3: PMID ---------------------------------------------------------
  if (ids.pmid) {
    const pm = await pubmedById(ids.pmid);
    checks.push({ source: 'PubMed', kind: 'id-lookup', outcome: pm.error ? 'error' : pm.found ? 'found' : 'absent', detail: pm.error });
    if (pm.error) return { ...result, status: STATUS.ERROR };
    if (!pm.found) return { ...result, status: STATUS.NOT_FOUND };
    return grade(result, pm.work, refText, meta, substance);
  }

  // --- Path 4: URL-only web reference ---------------------------------------
  if (ids.urls.length && substance < 6) {
    return { ...result, status: STATUS.UNCHECKABLE };
  }

  // --- Path 5: unstructured reference → registry search ---------------------
  const cs = await crossrefSearch(refText);
  checks.push({ source: 'Crossref', kind: 'bibliographic-search', outcome: cs.error ? 'error' : 'searched', detail: cs.error });
  let best = cs.error ? null : pickBest(cs.works, refText, meta);

  if (!best || best.scored.score < 0.75) {
    const oa = await openAlexSearch(refText);
    checks.push({ source: 'OpenAlex', kind: 'search', outcome: oa.error ? 'error' : 'searched', detail: oa.error });
    if (!oa.error) {
      const oaBest = pickBest(oa.works, refText, meta);
      if (oaBest && (!best || oaBest.scored.score > best.scored.score)) best = oaBest;
    }
  }

  if ((!best || best.scored.score < 0.55) && meta.bookish) {
    const ol = await openLibrarySearch(refText);
    checks.push({ source: 'Open Library', kind: 'search', outcome: ol.error ? 'error' : 'searched', detail: ol.error });
    if (!ol.error) {
      const olBest = pickBest(ol.works, refText, meta);
      if (olBest && (!best || olBest.scored.score > best.scored.score)) best = olBest;
    }
  }

  const searchChecks = checks.filter((c) => c.kind.includes('search'));
  if (searchChecks.length && searchChecks.every((c) => c.outcome === 'error')) {
    return { ...result, status: STATUS.ERROR };
  }

  if (best) {
    result.found = best.work;
    result.confidence = best.scored.score;
    result.scoreParts = best.scored.parts;
    if (best.work.retracted) result.retracted = true;
    if (best.scored.score >= 0.75) return { ...result, status: STATUS.LIKELY };
    if (best.scored.score >= 0.55) return { ...result, status: STATUS.PARTIAL };
  }
  // A ref anchored to a non-scholarly URL that we couldn't match is web
  // content we cannot fetch client-side — honesty demands "uncheckable",
  // not an accusation.
  if (ids.urls.length) return { ...result, status: STATUS.UNCHECKABLE };
  return { ...result, status: STATUS.NO_MATCH };
}

// ---------------------------------------------------------------------------
// Batch driver with bounded concurrency
// ---------------------------------------------------------------------------

export async function verifyAll(text, { concurrency = 4, onProgress } = {}) {
  const refs = splitReferences(text);
  const results = new Array(refs.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < refs.length) {
      const i = next++;
      try {
        results[i] = await verifyReference(refs[i]);
      } catch (e) {
        results[i] = { raw: refs[i], status: STATUS.ERROR, checks: [], error: e?.message };
      }
      results[i].index = i;
      done++;
      onProgress?.(done, refs.length, results[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, refs.length || 1) }, worker));
  return results;
}
