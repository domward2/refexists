/*
 * Live-API test harness for verifier.js — run with: node test/run-tests.mjs
 * Each case states the reference, the expected status (or set), and why.
 * These hit the real registries: they prove behaviour, not mocks.
 */
import {
  splitReferences,
  extractIdentifiers,
  extractMeta,
  verifyReference,
  STATUS,
} from '../public/verifier.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

// ---------- unit: segmentation ----------
console.log('\n[unit] splitReferences');
{
  const numbered = `[1] Smith, J. (2020). First paper. Nature.\n[2] Doe, A. (2021). Second paper.\n    Journal of Things, 5(2).`;
  const refs = splitReferences(numbered);
  check('numbered list → 2 refs with wrap folded', refs.length === 2 && refs[1].includes('Journal of Things'), JSON.stringify(refs));

  const blocks = `Vaswani, A. (2017). Attention is all you need.\nNeurIPS 30.\n\nWatson, J. (1953). Molecular structure of nucleic acids. Nature.`;
  const refs2 = splitReferences(blocks);
  check('blank-line blocks → 2 refs', refs2.length === 2, JSON.stringify(refs2));
}

// ---------- unit: identifier extraction ----------
console.log('\n[unit] extractIdentifiers');
{
  const lancet = extractIdentifiers('Wakefield et al. Lancet. doi:10.1016/S0140-6736(97)11096-0.');
  check('DOI with parens kept intact', lancet.doi === '10.1016/S0140-6736(97)11096-0', lancet.doi);

  const trail = extractIdentifiers('See https://doi.org/10.1038/171737a0.');
  check('trailing period stripped from DOI', trail.doi === '10.1038/171737a0', trail.doi);

  const ax = extractIdentifiers('Vaswani et al., arXiv:1706.03762v5');
  check('arXiv id extracted', ax.arxiv === '1706.03762', ax.arxiv);

  // C2: angle-bracket-wrapped DOI (LaTeX \url, plaintext, email)
  const angle = extractIdentifiers('Watson & Crick (1953). <https://doi.org/10.1038/171737a0>');
  check('C2: trailing > stripped from DOI', angle.doi === '10.1038/171737a0', angle.doi);
}

// ---------- unit: year extraction (I2) ----------
console.log('\n[unit] extractMeta year');
{
  check('I2: parenthesised year preferred over page span',
    extractMeta('Smith, J. (2019). A title. Journal, 5(2), pp. 2013-2020.').year === 2019,
    String(extractMeta('Smith, J. (2019). A title. Journal, 5(2), pp. 2013-2020.').year));
  check('I2: page range alone yields no year',
    extractMeta('Smith, J. A title. Journal, pp. 2013-2020.').year === undefined,
    String(extractMeta('Smith, J. A title. Journal, pp. 2013-2020.').year));
  check('I2: historical year in range (1925)',
    extractMeta('Fisher, R. A. (1925). Statistical Methods. Oliver and Boyd.').year === 1925,
    String(extractMeta('Fisher, R. A. (1925). Statistical Methods. Oliver and Boyd.').year));
}

// ---------- live: PASS cases (real citations must verify) ----------
console.log('\n[live] PASS cases');
{
  const r = await verifyReference(
    'Watson, J. D., & Crick, F. H. C. (1953). Molecular structure of nucleic acids: A structure for deoxyribose nucleic acid. Nature, 171(4356), 737–738. https://doi.org/10.1038/171737a0'
  );
  check('real DOI + matching metadata → verified', r.status === STATUS.VERIFIED, `${r.status} conf=${r.confidence?.toFixed(2)}`);
}
{
  const r = await verifyReference(
    'Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. Advances in Neural Information Processing Systems, 30.'
  );
  check('no identifier, real paper → likely/verified via search', [STATUS.LIKELY, STATUS.VERIFIED].includes(r.status), `${r.status} conf=${r.confidence?.toFixed(2)} found=${r.found?.title}`);
}
{
  const r = await verifyReference('Vaswani, A. et al. (2017). Attention is all you need. arXiv:1706.03762');
  check('arXiv id → verified via DataCite', [STATUS.VERIFIED, STATUS.LIKELY].includes(r.status), `${r.status} conf=${r.confidence?.toFixed(2)}`);
}

// ---------- live: FAIL cases (fabrications must be flagged) ----------
console.log('\n[live] FAIL cases (the harm we catch)');
{
  const r = await verifyReference(
    'Smith, J., & Chen, L. (2021). Quantum entanglement effects in maize genomics. Journal of Agricultural Physics, 12(3), 45–67. https://doi.org/10.1038/s41586-021-99999-x'
  );
  check('fabricated DOI → not_found', r.status === STATUS.NOT_FOUND, r.status);
}
{
  const r = await verifyReference(
    'Johnson, K. (2020). Deep learning approaches for protein folding prediction in clinical settings. https://doi.org/10.1038/171737a0'
  );
  check('real DOI, wrong paper (classic LLM stitch) → mismatch', r.status === STATUS.MISMATCH, `${r.status} conf=${r.confidence?.toFixed(2)} found=${r.found?.title}`);
}
{
  const r = await verifyReference(
    'Doe, A., & Nowhere, B. (2019). The neural correlates of imaginary breakfast decisions in adolescent populations. Nature Neuroscience, 22(5), 123–135.'
  );
  check('fully fabricated ref, no id → no_match', r.status === STATUS.NO_MATCH, `${r.status} conf=${r.confidence?.toFixed(2)} found=${r.found?.title}`);
}
{
  const r = await verifyReference(
    'Wakefield, A. J., et al. (1998). Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. The Lancet, 351(9103), 637–641. https://doi.org/10.1016/S0140-6736(97)11096-0'
  );
  check('retracted paper → flagged retracted', r.retracted === true, `retracted=${r.retracted} status=${r.status}`);
  check('retracted paper metadata still matches', [STATUS.VERIFIED, STATUS.PARTIAL].includes(r.status), r.status);
}
{
  const r = await verifyReference('Vaswani, A. et al. (2024). Attention is all you need 2: attention harder. arXiv:9912.99999');
  check('fabricated arXiv id → not_found', r.status === STATUS.NOT_FOUND, r.status);
}
{
  // C1: real DOI, fabricated authors + wrong year — must NOT be "Verified"
  const r = await verifyReference('Bogus, Q., & Fraud, Z. (1999). Attention is all you need. arXiv:1706.03762');
  check('C1: real arXiv id + fake authors/year → NOT verified', r.status !== STATUS.VERIFIED, `${r.status} conf=${r.confidence?.toFixed(2)}`);
  check('C1: downgraded to partial (check me)', r.status === STATUS.PARTIAL, r.status);
}
{
  // C1b: real DOI, fabricated authors + wrong year (Watson/Crick DOI)
  const r = await verifyReference('Fakeson, Q., & Notreal, Z. (1925). Molecular structure of nucleic acids: A structure for deoxyribose nucleic acid. https://doi.org/10.1038/171737a0');
  check('C1b: real DOI + fabricated authors/year → NOT verified', r.status !== STATUS.VERIFIED, `${r.status} conf=${r.confidence?.toFixed(2)}`);
}
{
  // C3: title-collision with fabricated authors, no identifier — not green
  const r = await verifyReference('Nobody, X., & Noone, Y. (2015). Deep residual learning for image recognition. Some Journal.');
  check('C3: title match + fake authors, no id → not LIKELY(green)', r.status !== STATUS.LIKELY, `${r.status} conf=${r.confidence?.toFixed(2)} found=${r.found?.title}`);
}
{
  // C2 live: angle-bracket DOI on a real paper → must verify, not accuse
  const r = await verifyReference('Watson, J. D., & Crick, F. H. C. (1953). Molecular structure of nucleic acids. Nature 171, 737. <https://doi.org/10.1038/171737a0>');
  check('C2 live: angle-bracket DOI → verified (not accused)', r.status === STATUS.VERIFIED, `${r.status} doi=${r.ids?.doi}`);
}

// ---------- live: honesty cases ----------
console.log('\n[live] honesty cases');
{
  const r = await verifyReference('BBC News (2023). Some article about something. https://www.bbc.co.uk/news/12345');
  check('web-only ref → uncheckable (not accused)', r.status === STATUS.UNCHECKABLE, r.status);
}
{
  const r = await verifyReference('Kahneman, D. (2011). Thinking, Fast and Slow. Farrar, Straus and Giroux, New York, first edition.');
  check('real book → found (not falsely accused)', [STATUS.LIKELY, STATUS.PARTIAL, STATUS.VERIFIED].includes(r.status), `${r.status} conf=${r.confidence?.toFixed(2)} found=${r.found?.title} src=${r.found?.source}`);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (failures.length) {
  console.log('Failed:', failures.join(' | '));
  process.exit(1);
}
