#!/usr/bin/env node
/*
 * refexists-mcp — a local, keyless MCP server that lets an AI agent verify its
 * own citations before it emits them. Wraps the same dependency-free engine as
 * https://refexists.dsl4.com. All registry calls run from THIS machine — there
 * is no hosted backend and nothing is sent anywhere but the six public
 * registries, exactly like the website. stdio transport.
 *
 * stdio footgun: stdout carries JSON-RPC frames. NEVER write to stdout here.
 * All diagnostics go to stderr.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Single source of truth for the engine: the packed copy (engine.js, created by
// `npm pack`/prepack) if present, else the repo's canonical file.
let engine;
try {
  engine = await import('./engine.js');
} catch {
  engine = await import('../public/verifier.js');
}
const { verifyAll, STATUS } = engine;

// Map internal status → agent-facing verdict + plain advice. Deliberately
// honest: absence with no identifier is "not_indexed" (not "fabricated"), and a
// registry error is never a verdict.
const VERDICT = {
  [STATUS.VERIFIED]:      { verdict: 'verified',           real: true,  advice: 'Identifier resolves and the registered title/author/year match. Safe to cite.' },
  [STATUS.LIKELY]:        { verdict: 'likely_real',        real: true,  advice: 'No identifier, but a registry record closely matches the title and author. Probably real — confirm the details.' },
  [STATUS.DOI_ONLY]:      { verdict: 'exists',             real: true,  advice: 'Bare identifier resolves; the citation gave no title/author/year to cross-check.' },
  [STATUS.PARTIAL]:       { verdict: 'check',              real: null,  advice: 'A record was found but only partly matches, or the details conflict. Verify by hand.' },
  [STATUS.UNVERIFIED_RA]: { verdict: 'exists_unconfirmed', real: true,  advice: 'The DOI is registered but its metadata is not machine-readable here. Existence confirmed, contents not.' },
  [STATUS.MISMATCH]:      { verdict: 'mismatch',           real: false, advice: 'The identifier is real but registered to a DIFFERENT work than the one cited. Classic fabrication signature — do not cite as-is.' },
  [STATUS.NOT_FOUND]:     { verdict: 'not_found',          real: false, advice: 'The identifier is definitively unregistered across all registries. Likely fabricated or badly mistyped.' },
  [STATUS.NO_MATCH]:      { verdict: 'not_indexed',        real: null,  advice: 'No identifier and no close match found. Could be fabricated, or simply not indexed (books, theses, non-English, very recent). Cannot tell which — verify before relying on it.' },
  [STATUS.UNCHECKABLE]:   { verdict: 'uncheckable',        real: null,  advice: 'Non-scholarly web source; cannot be verified against scholarly registries here.' },
  [STATUS.ERROR]:         { verdict: 'error',              real: null,  advice: 'A registry could not be reached. This is NOT a verdict about the reference — retry.' },
};

function toRecord(w) {
  if (!w) return null;
  return {
    title: w.title,
    authors: w.authors?.slice(0, 8),
    year: w.year,
    doi: w.doi,
    url: w.url,
    source: w.source,
  };
}

function summarize(results) {
  const refs = results.filter(Boolean).map((r) => {
    const m = VERDICT[r.status] || VERDICT[STATUS.ERROR];
    const verdict = r.retracted ? 'retracted' : m.verdict;
    const advice = r.retracted
      ? 'This work exists but has been RETRACTED. Citing it as valid evidence is misleading.'
      : m.advice;
    return {
      index: r.index,
      cited: r.raw.length > 240 ? r.raw.slice(0, 240) + '…' : r.raw,
      verdict,
      real: r.retracted ? false : m.real,
      retracted: !!r.retracted,
      confidence: typeof r.confidence === 'number' ? Math.round(r.confidence * 100) / 100 : undefined,
      advice,
      record: toRecord(r.found),
      registries_checked: (r.checks || []).map((c) => `${c.source}:${c.outcome}`),
    };
  });

  const counts = refs.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {});
  const flagged = refs.filter((r) => ['not_found', 'mismatch', 'retracted'].includes(r.verdict));
  const needsCheck = refs.filter((r) => ['check', 'not_indexed', 'uncheckable', 'error'].includes(r.verdict));

  return {
    total: refs.length,
    counts,
    any_suspect: flagged.length > 0,
    suspect: flagged.map((r) => ({ index: r.index, verdict: r.verdict, cited: r.cited })),
    needs_human_check: needsCheck.length,
    references: refs,
    disclaimer:
      'Absence verdicts require a definitive registry 404, never a network error. "not_indexed" is not proof of fabrication. Only "not_found" (confirmed-unregistered identifier) and "mismatch" (real identifier, wrong work) are provable. Does not cover legal/case-law citations.',
  };
}

function humanLine(s) {
  if (s.total === 0) return 'No references were recognised in the input.';
  const parts = Object.entries(s.counts).map(([k, v]) => `${v} ${k}`);
  const head = s.any_suspect
    ? `⚠ ${s.suspect.length} of ${s.total} reference(s) look SUSPECT (${s.suspect.map((x) => x.verdict).join(', ')}).`
    : `Checked ${s.total} reference(s); none are provably fabricated.`;
  return `${head} Breakdown: ${parts.join(', ')}.`;
}

const server = new McpServer({ name: 'refexists', version: '0.1.0' });

server.registerTool(
  'verify_citations',
  {
    title: 'Verify citations exist',
    description:
      'Verify that references/citations actually exist, by checking each against the public scholarly registries (Crossref, DataCite, doi.org, OpenAlex, PubMed, Open Library). Catches fabricated DOIs, AI-hallucinated references, a real DOI attached to the wrong paper, and retracted work. Accepts one reference or a whole bibliography (any common format: numbered, per-line, or per-block). Runs locally and keyless. Use this to self-check any citation before presenting it to the user. Does NOT verify that a real paper supports the claim it is cited for, and does not cover legal/case-law citations.',
    inputSchema: {
      text: z
        .string()
        .describe('One reference, or a bibliography/reference list. Plain text — numbered ([1]), one-per-line, or blank-line-separated blocks all work. DOIs, arXiv IDs and PMIDs are detected automatically.'),
    },
  },
  async ({ text }) => {
    const results = await verifyAll(text, { concurrency: 4 });
    const structured = summarize(results);
    return {
      content: [
        { type: 'text', text: humanLine(structured) },
        { type: 'text', text: JSON.stringify(structured, null, 2) },
      ],
      structuredContent: structured,
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[refexists-mcp] ready on stdio');
