# research-discovery MCP server

Literature discovery over two free scholarly APIs, **Semantic Scholar Graph API** and **OpenAlex**,
plus the **Elsevier API** (optional key) to fill abstracts the other two elide.
Start from seed papers, then walk references, citations, similar work, bibliometric neighbors and
authors. Read-only. Used by the `ae-literature` skill and the `ae-lit-scout` agent.

`harness/setup/setup.mjs` builds the server and registers it as `research_discovery` for Claude Code
(user scope) and Codex. For omp, add it to `~/.omp/agent/mcp.json` under `"mcpServers"`.

## Tools

| Tool | What it does |
|---|---|
| `paper_search` | Keyword search (optional `year_from`/`year_to`), or resolve one DOI/identifier. |
| `paper_get` | Full metadata for one paper: abstract (with `abstractSource`), authors, venue, counts, OA PDF. |
| `paper_references` | Papers the seed cites (Earlier Work), paginated. |
| `paper_citations` | Papers citing the seed (Later Work); `sort` = relevance / year / citationCount. |
| `paper_related` | Bibliographic coupling (shared references → recent siblings) and co-citation (read alongside → foundations), scored. |
| `topic_search` | Several phrasings in parallel; optionally filter/sort candidates by 2025 SJR Q1/Q2 or ABDC A*/A/B, with publication-year bounds. |
| `network_expand` | Seeds → references + citations + similar (optionally coupling/co-citation), ranked by how many seeds connect. One seed with `include=["similar"]` is the "Similar Work" view. |
| `author_search` / `author_get` / `author_papers` | Find an author, their profile, their papers. |
| `journal_rank_lookup` | Local journal-rank lookup by title or ISSN; no remote request. |

All tools take `response_format`: `markdown` (default) or `json` (compact). Exactly one of the
two is returned. `paper_id` accepts a DOI, Semantic Scholar id, `arXiv:…`, OpenAlex `W…`,
`CorpusId:…` or `PMID:…`.

## Behaviour that matters in practice

- **No Semantic Scholar key → OpenAlex does almost everything.** Without
  `SEMANTIC_SCHOLAR_API_KEY`, S2 returns 429 to nearly every request, and it returns 404 for many
  Elsevier DOIs. A 429 is therefore not retried without a key, and S2 is skipped for 60 s after one
  (`S2_COOLDOWN_MS`), so calls fall back to OpenAlex immediately.
- **With a key, S2 still 429s about half the time**, independent of client pacing (measured
  2026-10-23: same rate at 1.1 s and 2 s spacing). Where OpenAlex can answer the same call (DOI,
  OpenAlex and PMID ids, search), a keyed 429 falls through to OpenAlex at once and S2 is skipped
  for 10 s (`S2_KEYED_COOLDOWN_MS`). Only calls OpenAlex cannot answer (`arXiv:`, S2 and CorpusId
  paper ids, S2 author ids) retry, up to 4 times 1.1 s apart (`S2_KEYED_429_RETRIES`).
- **`paper_get` asks S2 and OpenAlex at once** for ids both understand, prefers the S2 record, and
  fills its abstract from OpenAlex when S2 has none, so an S2 miss costs no extra round trip.
- **OpenAlex and S2 have no abstracts for most Elsevier journals.** When `ELSEVIER_API_KEY` is set,
  `paper_get` fills a missing abstract for ScienceDirect DOIs (`10.1016/` and older Elsevier
  prefixes) from the Article Retrieval API (`view=META_ABS`, no institutional entitlement needed)
  and reports `abstractSource: "elsevier"`. For an Elsevier DOI that request starts alongside the
  metadata lookup. List tools (search, citations, expand) are not enriched,
  so only the papers an agent opens cost an Elsevier request. Without a usable abstract or OA PDF,
  claim checks must report `CANNOT-VERIFY`.
- **Responses are cached in memory for one hour and on disk for 7 days** (`CACHE_TTL_MS`,
  `DISK_CACHE_TTL_MS`), and concurrent identical requests share one fetch. The disk cache
  (`~/.cache/research-discovery`, one JSON file per URL) is shared by every server process, and each
  agent session starts its own, so a paper one agent or session looked up is instant for the next.
  404s are cached for a day; 429s, 5xx and network errors never. Expired files are deleted at
  startup. `RESEARCH_DISCOVERY_CACHE_DIR` moves the cache, or disables it with `off`.
- **All OpenAlex requests in a process share 8 in-flight slots** (`OPENALEX_MAX_IN_FLIGHT`). OpenAlex
  allows ~10 requests/s; at ~1 s latency 10 in flight was clean and 16 drew 429s on half the calls.
  Fan-out helpers run 8 at a time (`FANOUT_CONCURRENCY`) within that cap.
- `paper_related` co-citation fetches every citer's reference list in batched requests (50 citers per
  call) and hydrates only the leading candidates; coupling still runs one request per seed reference.
  It takes ~6 s cold; the other tools take 0–2.5 s.

## Journal-rank filtering (local, no extra API calls)

- `journal_rank_lookup` searches the imported local index by ISSN (exact) or title fragment; set
  `field_of_research` with source `ABDC` to select a four-digit ABDC field.
- `topic_search` accepts `journal_rank_source: "SJR" | "ABDC"`, `journal_ranks`, and
  `journal_subject_category` (SJR only) or `journal_field_of_research` (ABDC only, e.g. `3801`).
  `sort: "journalRank"` sorts within the selected system. ABDC grades are FoR-specific; set the code
  when the target discipline is known. No conversions are made between SJR quartiles and ABDC grades.
- `year_from` / `year_to` constrain **paper publication year** at the upstream search. The local
  rank edition is separately labeled **2025**. The current index contains SJR Q1/Q2 rows and ABDC
  A*/A/B rows only.
- Rank annotation/filtering runs against a title index loaded once in memory at startup. `topic_search`
  queries scholarly APIs once per phrase as usual, then filters the candidate set locally; no API
  request is made per paper or per journal. `per_query` caps upstream candidates (default 15, max 50),
  so increase it when ranked filtering returns too few papers. Rank matching for papers uses normalized
  venue titles; unmatched candidate counts are reported. The direct lookup tool supports exact ISSN.
- The generated `data/journal-ranks.json` is intentionally git-ignored. It is locally generated from
  the SJR 2025 CSV and official ABDC 2025 workbook supplied for this workstation; the importer
  writes it beside `dist/`. Without it, the rest of the MCP remains available, while rank tools return
  an explicit import error. Keep source attribution and check each provider's reuse terms before redistributing.

Rebuild the local index with Python `openpyxl` installed:

```bash
python -m pip install -r scripts/requirements-journal-ranks.txt
npm run ranks:import -- "C:/path/scimagojr 2025.csv" "C:/path/ABDC-JQL-2025.xlsx"
```

Sources: [SCImago 2025](https://www.scimagojr.com/journalrank.php?year=2025), attribution to
SCImago Journal & Country Rank; [ABDC Journal Quality List](https://abdc.edu.au/abdc-journal-quality-list/),
2025 workbook. The ABDC website identifies its 2025 list as the current reviewed edition.

## Environment

| Variable | Purpose |
|---|---|
| `OPENALEX_EMAIL` | Recommended. Sent as `mailto=` to join OpenAlex's polite pool. |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional free key (<https://www.semanticscholar.org/product/api>). Enables S2 as the primary source. |
| `ELSEVIER_API_KEY` | Optional free key (<https://dev.elsevier.com>). Fills Elsevier abstracts in `paper_get`. |

Setup passes them to the server when it registers it, so set them before running setup.
For omp, put them in the server's `env` block in `~/.omp/agent/mcp.json`. `RESEARCH_DISCOVERY_CACHE_DIR`
(optional) sets the disk-cache directory, or `off`.

## Build and test

```bash
npm ci
npm run build                     # TypeScript -> dist/
node scripts/protocol-test.mjs    # every tool over MCP stdio, disk cache off; exits 1 on failure
npm run test:ranks                # local matching, FoR/category filters, and offline MCP rank tool
node scripts/bench.mjs            # latency and payload size per tool
RESEARCH_DISCOVERY_CACHE_DIR="$(mktemp -d)" node scripts/bench.mjs cold   # rerun with same dir for warm
```

`protocol-test.mjs` and `bench.mjs` read the keys from the environment, falling back to the
`research_discovery.env` block in `~/.omp/agent/mcp.json`.

Reference runs before the rank lookup tool, 11 benchmark calls. Without any variable (2026-10-22):
19.5 s (previously 101 s); `tools/list` is 16 k characters (previously 46 k). With all three
variables (2026-10-23): 46.4 s when keyed 429s were always retried; after fail-fast, parallel
lookups, the OpenAlex slot cap, and batched co-citation: 16.6 s cold, 0.8 s warm from the disk cache
in a new process (58 files, 9.4 MB). `protocol-test.mjs` with keys: 42.6 s → 19.6 s.

## Layout

```
src/
  index.ts        entry point, registers tools over stdio
  apiClient.ts    HTTP: auth, polite pool, timeout, retry, memory + disk cache, OpenAlex slot cap, S2 circuit breaker
  discovery.ts    search/get/references/citations/similar/authors/coupling/co-citation + fallback
  utils.ts        id normalization, abstract reconstruction, converters, de-duplication
  schemas.ts      Zod input fragments and JSON item shapes
  journalRanks.ts local 2025 SJR/ABDC index: exact ISSN and normalized journal-title matching
  tools/          papers.ts, authors.ts, network.ts, topic.ts, ranks.ts, shared.ts
scripts/          protocol-test.mjs, rank-test.mjs, rank-mcp-test.mjs, bench.mjs, import_journal_ranks.py
```
