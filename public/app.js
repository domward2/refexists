/* app.js — UI wiring for RefExists. All dynamic text is inserted via
   textContent/createElement: user input and registry responses are never
   parsed as HTML. */

import { verifyAll, STATUS } from './verifier.js';

const form = document.getElementById('check-form');
const input = document.getElementById('refs-input');
const checkBtn = document.getElementById('check-btn');
const exampleBtn = document.getElementById('example-btn');
const progressEl = document.getElementById('progress');
const resultsSection = document.getElementById('results-section');
const summaryEl = document.getElementById('summary');
const listEl = document.getElementById('results');

// Example INPUT only — verification always runs live against the registries.
const EXAMPLE = `[1] Watson, J. D., & Crick, F. H. C. (1953). Molecular structure of nucleic acids: A structure for deoxyribose nucleic acid. Nature, 171(4356), 737–738. https://doi.org/10.1038/171737a0
[2] Vaswani, A., Shazeer, N., Parmar, N., et al. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30.
[3] Smith, J., & Chen, L. (2021). Quantum entanglement effects in maize genomics. Journal of Agricultural Physics, 12(3), 45–67. https://doi.org/10.1038/s41586-021-99999-x
[4] Johnson, K. (2020). Deep learning approaches for protein folding prediction in clinical settings. https://doi.org/10.1038/171737a0
[5] Wakefield, A. J., et al. (1998). Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. The Lancet, 351(9103), 637–641. https://doi.org/10.1016/S0140-6736(97)11096-0
[6] Doe, A., & Nowhere, B. (2019). The neural correlates of imaginary breakfast decisions in adolescent populations. Nature Neuroscience, 22(5), 123–135.
[7] Kahneman, D. (2011). Thinking, Fast and Slow. Farrar, Straus and Giroux, New York.
[8] BBC News (2023). Rise in fabricated citations reported by universities. https://www.bbc.co.uk/news/education-00000000`;

const STAMP = {
  [STATUS.VERIFIED]:      { text: 'Verified',    cls: 'stamp-green',                 tally: 'green',
    line: 'The identifier resolves and the registered metadata matches this citation.' },
  [STATUS.LIKELY]:        { text: 'Match found', cls: 'stamp-green stamp-outline',   tally: 'green',
    line: 'No identifier given, but a registry record closely matches the cited title, author and year.' },
  [STATUS.DOI_ONLY]:      { text: 'Exists',      cls: 'stamp-green stamp-outline',   tally: 'green',
    line: 'Bare identifier — it resolves, but the citation gives nothing further to compare.' },
  [STATUS.PARTIAL]:       { text: 'Check me',    cls: 'stamp-amber',                 tally: 'amber',
    line: 'A record was found but only partly matches. Compare the two below by hand.' },
  [STATUS.UNVERIFIED_RA]: { text: 'Unconfirmed', cls: 'stamp-amber stamp-outline',   tally: 'amber',
    line: 'The DOI is registered (doi.org confirms it exists) with an agency whose metadata this tool cannot read.' },
  [STATUS.MISMATCH]:      { text: 'Mismatch',    cls: 'stamp-red',                   tally: 'red',
    line: 'This identifier is real but registered to a different work than the one cited — a classic fabrication signature. Compare below.' },
  [STATUS.NOT_FOUND]:     { text: 'Not found',   cls: 'stamp-red',                   tally: 'red',
    line: 'This identifier is definitively absent from the global registries (confirmed, not a network error). It may be fabricated or badly mistyped.' },
  [STATUS.NO_MATCH]:      { text: 'No record',   cls: 'stamp-red stamp-outline',     tally: 'red',
    line: 'Nothing close was found in 250M+ indexed works. Could be fabricated — or misspelled, very new, or not indexed. Treat as a lead to verify, not a conviction.' },
  [STATUS.UNCHECKABLE]:   { text: "Can't check", cls: 'stamp-grey',                  tally: 'grey',
    line: 'Web content — your browser cannot fetch other websites to verify this. Open the link and check it yourself.' },
  [STATUS.ERROR]:         { text: 'Retry',       cls: 'stamp-grey stamp-outline',    tally: 'grey',
    line: 'A registry could not be reached. This is not a verdict about the reference — try again.' },
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function fmtWork(w) {
  if (!w) return '';
  const bits = [];
  if (w.title) bits.push(`“${w.title}”`);
  if (w.authors?.length) bits.push(w.authors.slice(0, 3).join(', ') + (w.authors.length > 3 ? ' et al.' : ''));
  if (w.year) bits.push(String(w.year));
  if (w.container) bits.push(w.container);
  return bits.join(' · ');
}

function renderCard(r) {
  const conf = STAMP[r.status] || STAMP[STATUS.ERROR];
  const li = el('li', 'card');

  const head = el('div', 'card-head');
  const left = el('div');
  left.appendChild(el('div', 'card-num', `REF ${String(r.index + 1).padStart(2, '0')}`));
  left.appendChild(el('p', 'card-cited', r.raw));
  head.appendChild(left);

  const stamp = el('span', `stamp ${r.retracted ? 'stamp-redheavy' : conf.cls}`, r.retracted ? 'Retracted' : conf.text);
  stamp.setAttribute('role', 'img');
  stamp.setAttribute('aria-label', `Verdict: ${r.retracted ? 'Retracted' : conf.text}`);
  head.appendChild(stamp);
  li.appendChild(head);

  if (r.retracted) {
    const banner = el('div', 'retraction-banner');
    banner.append(
      el('strong', null, 'This work has been retracted. '),
      document.createTextNode('It exists, but citing it as valid evidence is misleading. Verify at '),
    );
    const rw = el('a', null, 'Retraction Watch');
    rw.href = 'http://retractiondatabase.org/';
    rw.rel = 'noopener';
    banner.appendChild(rw);
    banner.appendChild(document.createTextNode('.'));
    li.appendChild(banner);
    li.appendChild(el('p', 'verdict-line', `Underlying check: ${conf.line}`));
  } else {
    li.appendChild(el('p', 'verdict-line', conf.line));
  }

  // Side-by-side comparison for the dangerous cases
  if ((r.status === STATUS.MISMATCH || r.status === STATUS.PARTIAL) && r.found?.title) {
    const cmp = el('div', 'compare');
    const a = el('div', 'cmp cmp-cited');
    a.appendChild(el('b', null, 'cited as'));
    a.appendChild(document.createTextNode(r.raw.length > 220 ? r.raw.slice(0, 220) + '…' : r.raw));
    const b = el('div', 'cmp cmp-found');
    b.appendChild(el('b', null, `registry has (${r.found.source})`));
    b.appendChild(document.createTextNode(fmtWork(r.found)));
    cmp.append(a, b);
    li.appendChild(cmp);
  }

  const ev = el('div', 'evidence');

  if (r.found && r.status !== STATUS.MISMATCH && r.status !== STATUS.PARTIAL) {
    const row = el('div', 'evidence-row');
    row.appendChild(el('span', 'evidence-key', 'record'));
    const val = el('span', 'evidence-val');
    val.appendChild(document.createTextNode(fmtWork(r.found) + ' '));
    ev.appendChild(row);
    row.appendChild(val);
  }
  if (r.found?.url) {
    const row = el('div', 'evidence-row');
    row.appendChild(el('span', 'evidence-key', 'source'));
    const val = el('span', 'evidence-val');
    const a = el('a', null, r.found.url.replace(/^https?:\/\//, ''));
    a.href = r.found.url;
    a.rel = 'noopener';
    a.target = '_blank';
    val.appendChild(a);
    val.appendChild(document.createTextNode(` — via ${r.found.source}`));
    row.appendChild(val);
    ev.appendChild(row);
  }
  if (typeof r.confidence === 'number' && r.status !== STATUS.DOI_ONLY) {
    const row = el('div', 'evidence-row');
    row.appendChild(el('span', 'evidence-key', 'match'));
    const val = el('span', 'evidence-val');
    const pct = Math.round(r.confidence * 100);
    val.appendChild(el('span', pct >= 60 ? 'ok' : 'bad', `${pct}%`));
    val.appendChild(document.createTextNode(' similarity between your citation and the registry record (title · author · year)'));
    row.appendChild(val);
    ev.appendChild(row);
  }
  if (r.ids?.doi) {
    const row = el('div', 'evidence-row');
    row.appendChild(el('span', 'evidence-key', 'identifier'));
    row.appendChild(el('span', 'evidence-val', `doi:${r.ids.doi}`));
    ev.appendChild(row);
  } else if (r.ids?.arxiv) {
    const row = el('div', 'evidence-row');
    row.appendChild(el('span', 'evidence-key', 'identifier'));
    row.appendChild(el('span', 'evidence-val', `arXiv:${r.ids.arxiv}`));
    ev.appendChild(row);
  } else if (r.ids?.pmid) {
    const row = el('div', 'evidence-row');
    row.appendChild(el('span', 'evidence-key', 'identifier'));
    row.appendChild(el('span', 'evidence-val', `PMID:${r.ids.pmid}`));
    ev.appendChild(row);
  }

  if (r.checks?.length) {
    const chips = el('div', 'checks-row');
    chips.setAttribute('aria-label', 'Registries consulted');
    for (const c of r.checks) {
      const label =
        c.outcome === 'found' ? `${c.source} ✓` :
        c.outcome === 'absent' ? `${c.source} ✗ not registered` :
        c.outcome === 'retracted' ? `${c.source} ⚑ retracted` :
        c.outcome === 'clear' ? `${c.source} ✓ no retraction` :
        c.outcome === 'searched' ? `${c.source} · searched` :
        `${c.source} ! unreachable`;
      chips.appendChild(el('span', `check-chip ${c.outcome === 'error' ? 'error' : c.outcome === 'absent' ? 'absent' : (c.outcome === 'found' || c.outcome === 'clear') ? 'found' : ''}`, label));
    }
    ev.appendChild(chips);
  }

  li.appendChild(ev);
  return li;
}

function renderSummary(results) {
  summaryEl.textContent = '';
  const buckets = { green: 0, amber: 0, red: 0, grey: 0 };
  let retracted = 0;
  for (const r of results) {
    if (!r) continue;
    if (r.retracted) { retracted++; buckets.red++; continue; }
    buckets[(STAMP[r.status] || STAMP[STATUS.ERROR]).tally]++;
  }
  const n = results.filter(Boolean).length;
  summaryEl.appendChild(el('span', 'tally', `${n} reference${n === 1 ? '' : 's'} checked`));
  if (buckets.green) summaryEl.appendChild(el('span', 'tally tally-green', `${buckets.green} check out`));
  if (buckets.amber) summaryEl.appendChild(el('span', 'tally tally-amber', `${buckets.amber} need a human look`));
  if (buckets.red) summaryEl.appendChild(el('span', 'tally tally-red', `${buckets.red} suspect${retracted ? ` (${retracted} retracted)` : ''}`));
  if (buckets.grey) summaryEl.appendChild(el('span', 'tally tally-grey', `${buckets.grey} couldn't be checked`));
}

let running = false;

async function runCheck() {
  if (running) return;
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  running = true;
  checkBtn.disabled = true;
  resultsSection.hidden = false;
  listEl.textContent = '';
  summaryEl.textContent = '';
  progressEl.textContent = 'Consulting registries…';

  const seen = [];
  try {
    const results = await verifyAll(text, {
      onProgress(done, total, r) {
        progressEl.textContent = `Checked ${done} of ${total}…`;
        seen.push(r);
        listEl.appendChild(renderCard(r));
        renderSummary(seen);
      },
    });
    // Re-render in input order once complete (progress order is completion order)
    listEl.textContent = '';
    for (const r of results) if (r) listEl.appendChild(renderCard(r));
    renderSummary(results);
    progressEl.textContent = results.length ? 'Done.' : 'No references recognised — paste one per line or a numbered list.';
    if (!results.length) resultsSection.hidden = true;
  } catch (e) {
    progressEl.textContent = 'Something went wrong talking to the registries — please retry.';
  } finally {
    running = false;
    checkBtn.disabled = false;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  runCheck();
});

exampleBtn.addEventListener('click', () => {
  input.value = EXAMPLE;
  input.focus();
  runCheck();
});
