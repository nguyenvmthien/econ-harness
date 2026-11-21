/**
 * Latency + payload benchmark over the real MCP stdio protocol, using the environment
 * the server actually runs with: the `research_discovery.env` block of ~/.omp/agent/mcp.json
 * (API keys, OpenAlex email) when present. RESEARCH_DISCOVERY_CACHE_DIR in the caller's
 * environment overrides the disk cache ("off", or a fresh directory for a cold run).
 * Prints one line per tool call: seconds, characters of text returned, characters of
 * structuredContent, source, error.
 *   node scripts/bench.mjs [label]
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

let serverEnv = {};
try {
  serverEnv = JSON.parse(readFileSync(join(homedir(), ".omp/agent/mcp.json"), "utf8")).mcpServers?.research_discovery?.env ?? {};
} catch {}
// Process environment (setup sets these as user env vars) overrides the omp mcp.json block.
for (const k of ["OPENALEX_EMAIL", "SEMANTIC_SCHOLAR_API_KEY", "ELSEVIER_API_KEY"]) {
  if (process.env[k]?.trim()) serverEnv[k] = process.env[k].trim();
}
const cacheDir = process.env.RESEARCH_DISCOVERY_CACHE_DIR;

const DOI = "10.1016/j.jeconom.2020.12.001"; // Callaway & Sant'Anna (2021)
const DOI2 = "10.1016/j.jeconom.2020.09.006"; // Sun & Abraham (2021)
const calls = [
  ["paper_search", { query: "staggered difference-in-differences heterogeneous treatment effects", limit: 10 }],
  ["paper_search", { query: DOI }],
  ["paper_get", { paper_id: DOI }],
  ["paper_references", { paper_id: DOI, limit: 10 }],
  ["paper_citations", { paper_id: DOI, limit: 10 }],
  ["paper_citations", { paper_id: DOI, limit: 10, sort: "citationCount" }],
  ["network_expand", { paper_ids: [DOI], include: ["similar"], limit: 10 }],
  ["topic_search", { queries: ["bank capital regulation lending", "capital requirements credit supply", "Basel III bank lending"], per_query: 10, limit: 15 }],
  ["author_search", { name: "Pedro Sant'Anna", limit: 5 }],
  ["journal_rank_lookup", { query: "American Economic Review", source: "SJR", limit: 10 }],
  ["network_expand", { paper_ids: [DOI, DOI2], per_seed: 15, limit: 10 }],
  ["paper_related", { paper_id: DOI, method: "both", limit: 10 }],
];

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  stderr: "ignore",
  env: { ...getDefaultEnvironment(), ...serverEnv, ...(cacheDir ? { RESEARCH_DISCOVERY_CACHE_DIR: cacheDir } : {}) },
});
const client = new Client({ name: "bench", version: "1.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
const listChars = JSON.stringify(tools).length;
console.log(`label=${process.argv[2] ?? "run"} tools=${tools.length} tools/list chars=${listChars}`);
let total = 0;
for (const [name, args] of calls) {
  const t0 = performance.now();
  let res;
  try {
    res = await client.callTool({ name, arguments: args }, undefined, { timeout: 600_000 });
  } catch (e) {
    res = { isError: true, content: [{ text: String(e) }] };
  }
  const s = (performance.now() - t0) / 1000;
  total += s;
  const text = res.content?.[0]?.text ?? "";
  const sc = res.structuredContent ? JSON.stringify(res.structuredContent).length : 0;
  const src = res.structuredContent?.source ?? res.structuredContent?.sources_used?.join("+") ?? "-";
  console.log(`${s.toFixed(1).padStart(6)}s  text=${String(text.length).padStart(6)}  structured=${String(sc).padStart(6)}  ${name.padEnd(16)} src=${src}${res.isError ? `  ERROR: ${text.slice(0, 120)}` : ""}`);
}
console.log(`total ${total.toFixed(1)}s`);
await client.close();
process.exit(0);
