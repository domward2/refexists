/*
 * End-to-end MCP test: spawn server.js over stdio via the real MCP SDK client,
 * list tools, and call verify_citations with a mixed bibliography.
 * Run: node test-client.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: 'node', args: ['server.js'] });
const client = new Client({ name: 'refexists-test', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log('TOOLS:', tools.map((t) => t.name).join(', '));

const input = `[1] Watson, J. D., & Crick, F. H. C. (1953). Molecular structure of nucleic acids. Nature, 171, 737. https://doi.org/10.1038/171737a0
[2] Smith, J. (2021). Quantum entanglement effects in maize genomics. https://doi.org/10.1038/s41586-021-99999-x
[3] Wakefield, A. J. (1998). Ileal-lymphoid-nodular hyperplasia... The Lancet, 351, 637. https://doi.org/10.1016/S0140-6736(97)11096-0`;

const res = await client.callTool({ name: 'verify_citations', arguments: { text: input } });

console.log('\nHUMAN SUMMARY:\n ', res.content[0].text);
const s = res.structuredContent;
console.log('\nPER-REFERENCE:');
for (const r of s.references) {
  console.log(`  [${r.index + 1}] ${r.verdict.toUpperCase()} (real=${r.real}, retracted=${r.retracted}) — ${r.record?.title?.slice(0, 45) ?? 'no record'}`);
}
console.log('\nany_suspect:', s.any_suspect, '| suspect:', s.suspect.map((x) => `#${x.index + 1}:${x.verdict}`).join(', '));

await client.close();

// Assert expected behaviour
const byIdx = Object.fromEntries(s.references.map((r) => [r.index, r.verdict]));
const ok =
  byIdx[0] === 'verified' &&
  byIdx[1] === 'not_found' &&
  byIdx[2] === 'retracted' &&
  s.any_suspect === true;
console.log('\n==== E2E MCP TEST:', ok ? 'PASS' : 'FAIL', '====');
process.exit(ok ? 0 : 1);
