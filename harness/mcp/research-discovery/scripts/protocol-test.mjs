/**
 * End-to-end MCP protocol test: spawns the built server over stdio, lists tools, and
 * calls every tool once with response_format="json", checking the payload shape.
 * Uses OPENALEX_EMAIL / SEMANTIC_SCHOLAR_API_KEY / ELSEVIER_API_KEY from the environment, falling
 * back to the `research_discovery.env` block of ~/.omp/agent/mcp.json when present, with the disk cache off so every call reaches the network.
 * Exits 1 on the first failure.
 *   node scripts/protocol-test.mjs
 */
import { existsSync, readFileSync } from "node:fs";
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

const DOI = "10.1016/j.jeconom.2020.12.001"; // Callaway & Sant'Anna (2021)
const DOI2 = "10.1016/j.jeconom.2020.09.006"; // Sun & Abraham (2021)

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  stderr: "ignore",
  env: { ...getDefaultEnvironment(), ...serverEnv, RESEARCH_DISCOVERY_CACHE_DIR: "off" },
});
const client = new Client({ name: "protocol-test", version: "1.0.0" });

function check(cond, msg) {
  if (!cond) {
    console.error(`✘ ${msg}`);
    process.exit(1);
  }
  console.log(`✔ ${msg}`);
}

async function call(name, args) {
  const res = await client.callTool({ name, arguments: { ...args, response_format: "json" } }, undefined, { timeout: 300_000 });
  if (res.isError) check(false, `${name} returned error: ${res.content[0]?.text}`);
  check(res.structuredContent === undefined && res.content.length === 1, `${name}: single text payload`);
  return JSON.parse(res.content[0].text);
}

await client.connect(transport);
const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
check(
  names.join(",") ===
    "author_get,author_papers,author_search,journal_rank_lookup,network_expand,paper_citations,paper_get,paper_references,paper_related,paper_search,topic_search",
  `tools/list -> ${names.length} tools`,
);

// Journal ranks are optional: without data/journal-ranks.json the rank tool must fail with a clear
// import hint and every other tool must still work.
const HAS_RANKS = existsSync(new URL("../data/journal-ranks.json", import.meta.url));
if (HAS_RANKS) {
  const aerAbdc = await call("journal_rank_lookup", { query: "0002-8282", source: "ABDC", field_of_research: "3801", limit: 5 });
  check(aerAbdc.results.some((row) => row.title === "The American Economic Review" && row.rank === "A*" && row.fieldOfResearch === "3801"), "journal_rank_lookup ISSN/FoR -> ABDC A* economics");
  const aerSjr = await call("journal_rank_lookup", { query: "American Economic Review", source: "SJR", limit: 5 });
  check(aerSjr.results.some((row) => row.rank === "Q1" && row.subjectCategories.some((category) => category.name === "Economics and Econometrics")), "journal_rank_lookup title -> SJR Q1 economics");
} else {
  const res = await client.callTool({ name: "journal_rank_lookup", arguments: { query: "0002-8282", source: "ABDC" } }, undefined, { timeout: 60_000 });
  check(res.isError && /ranks:import/.test(res.content[0]?.text ?? ""), "journal_rank_lookup without index -> clear 'npm run ranks:import' error (ranks not imported; rank checks skipped)");
}

const seed = (await call("paper_search", { query: DOI })).results[0];
check(seed.doi === DOI, `paper_search(DOI) resolves ${seed.doi}`);

const recent = await call("paper_search", { query: "staggered difference-in-differences", year_from: 2022, limit: 5 });
check(recent.results.length > 0 && recent.results.every((p) => p.year === null || p.year >= 2022), "paper_search year_from=2022 respected");

const paper = (await call("paper_get", { paper_id: DOI })).paper;
check(paper.title.toLowerCase().includes("difference-in-differences"), `paper_get -> "${paper.title.slice(0, 50)}"`);

const refs = await call("paper_references", { paper_id: DOI, limit: 5 });
check(refs.references.length > 0, `paper_references -> ${refs.references.length} via ${refs.source}`);

const cites = await call("paper_citations", { paper_id: DOI, limit: 5, sort: "citationCount" });
const counts = cites.citations.map((p) => p.citationCount ?? 0);
check(counts.length > 0 && counts.every((c, i) => i === 0 || counts[i - 1] >= c), "paper_citations sort=citationCount is descending");

const related = await call("paper_related", { paper_id: DOI, method: "coupling", limit: 5 });
check(related.coupling.length > 0, `paper_related coupling -> ${related.coupling.length}`);

const topic = await call("topic_search", { queries: ["bank capital requirements lending", "Basel III credit supply"], per_query: 5, limit: 8 });
check(topic.results.length > 0 && topic.results.every((p) => p.matched_queries.length >= 1), `topic_search -> ${topic.results.length}`);
if (HAS_RANKS) {
  const rankedTopic = await call("topic_search", {
    queries: ["bank capital requirements lending", "Basel III credit supply"],
    year_from: 2010,
    year_to: 2025,
    per_query: 50,
    limit: 8,
    journal_rank_source: "SJR",
    journal_ranks: ["Q1", "Q2"],
    sort: "journalRank",
  });
  check(
    rankedTopic.results.length > 0 &&
      rankedTopic.results.every((paper) => paper.journal_rank?.source === "SJR" && ["Q1", "Q2"].includes(paper.journal_rank.rank)),
    `topic_search SJR Q1/Q2 filter and rank sort -> ${rankedTopic.results.length}`,
  );
}

const similar = await call("network_expand", { paper_ids: [DOI], include: ["similar"], limit: 5 });
check(similar.results.length > 0, `network_expand single seed include=similar -> ${similar.results.length}`);

const expand = await call("network_expand", { paper_ids: [DOI, DOI2], per_seed: 15, limit: 5 });
check(expand.results[0]?.connection_count === 2, `network_expand two seeds -> top connected to ${expand.results[0]?.connection_count}`);

const authors = await call("author_search", { name: "Pedro H. C. Sant'Anna", limit: 3 });
const authorId = authors.authors[0].authorId ?? authors.authors[0].openAlexId;
check(Boolean(authorId), `author_search -> ${authors.authors[0].name} (${authorId})`);
const author = (await call("author_get", { author_id: authorId })).author;
check(author.name.length > 0, `author_get -> ${author.name}`);
const authorPapers = await call("author_papers", { author_id: authorId, limit: 3 });
check(authorPapers.papers.length > 0, `author_papers -> ${authorPapers.papers.length}`);

const md = await client.callTool({ name: "paper_get", arguments: { paper_id: DOI } });
check(md.content[0].text.startsWith("# "), "default response_format is markdown");

const bad = await client.callTool({ name: "paper_get", arguments: { paper_id: "not-a-real-id-xyz" } });
check(bad.isError === true, `error path -> "${bad.content[0].text.slice(0, 60)}…"`);

await client.close();
console.log("\nPROTOCOL TEST PASSED");
process.exit(0);
