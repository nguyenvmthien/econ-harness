/**
 * topic_search — multi-vocabulary fan-out for gap-hunting.
 *
 * The caller supplies SEVERAL keyword/phrasing variants of one topic (different
 * communities use different terms). The tool runs them all, merges + de-duplicates,
 * records which variants surfaced each paper, and can filter/rank by local journal data.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FANOUT_CONCURRENCY } from "../constants.js";
import { searchPapers } from "../discovery.js";
import { buildResult, errorResult, toListItem } from "../format.js";
import { bestVenueRank, rankSortValue, rankSources, type RankBucket, type RankSource } from "../journalRanks.js";
import { ResponseFormat, responseFormatInput, yearFromInput, yearToInput } from "../schemas.js";
import type { NormalizedPaper } from "../types.js";
import { authorNames, mapWithConcurrency, paperKey } from "../utils.js";

const PREPRINT_RE = /arxiv|ssrn|preprint|research square|biorxiv|medrxiv|working paper|nber|cepr/i;

function looksPreprint(paper: NormalizedPaper): boolean {
  if (paper.venue && PREPRINT_RE.test(paper.venue)) return true;
  if (!paper.venue && paper.arxivId) return true;
  return false;
}

export function registerTopicTools(server: McpServer): void {
  server.registerTool(
    "topic_search",
    {
      title: "Multi-keyword topic sweep",
      description: `Search several keyword variants in parallel, merge/deduplicate results, and optionally filter/rank them using the local 2025 SCImago Q1/Q2 or ABDC A*/A/B journal index. Publication-year filters apply upstream; journal-rank editions use their own 2025 data year. Rank matching is local by normalized venue title and adds no ranking API calls.

Examples:
  - Gap sweep: queries=["greenwashing measurement","ESG decoupling","selective environmental disclosure"], year_from=2022, year_to=2025.
  - Economics journals: journal_rank_source="ABDC", journal_ranks=["A*","A"], journal_field_of_research="3801", sort="journalRank".
  - Do not use for one exact paper (use paper_search) or to traverse a known seed's graph (use network_expand / paper_related).`,
      inputSchema: {
        queries: z.array(z.string().min(2).max(300)).min(1).max(10).describe("1-10 keyword/phrasing variants of the topic."),
        year_from: yearFromInput,
        year_to: yearToInput,
        per_query: z.number().int().min(1).max(50).default(15).describe("Candidates fetched per variant before local rank filtering (default 15; increase for more rank-filtered recall)."),
        limit: z.number().int().min(1).max(100).default(25).describe("Max merged results (default 25)."),
        include_preprints: z.boolean().default(true).describe("Keep preprints/working papers (default true)."),
        sort: z.enum(["relevance", "recency", "citationCount", "journalRank"]).default("relevance").describe("Ordering of merged results; journalRank requires journal_rank_source."),
        journal_rank_source: z.enum(["SJR", "ABDC"]).optional().describe("Filter or sort using the local 2025 SJR or ABDC rank data; no network lookup."),
        journal_ranks: z.array(z.enum(["Q1", "Q2", "A*", "A", "B"])).min(1).optional().describe("Allowed ranks: SJR supports Q1/Q2; ABDC supports A*/A/B. Defaults to all supported ranks for the selected source."),
        journal_subject_category: z.string().min(2).max(120).optional().describe("Optional SJR subject-category substring (e.g. Economics and Econometrics); only valid with SJR."),
        journal_field_of_research: z.string().regex(/^\d{4}$/).optional().describe("Optional four-digit ABDC FoR code (e.g. 3801 economics); only valid with ABDC."),
        response_format: responseFormatInput,
      },
      annotations: { title: "Topic sweep", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ queries, year_from, year_to, per_query, limit, include_preprints, sort, journal_rank_source, journal_ranks, journal_subject_category, journal_field_of_research, response_format }) => {
      try {
        if (journal_ranks?.length && !journal_rank_source) return errorResult("journal_ranks requires journal_rank_source.");
        if (journal_subject_category && journal_rank_source !== "SJR") return errorResult("journal_subject_category is supported only with journal_rank_source='SJR'.");
        if (journal_field_of_research && journal_rank_source !== "ABDC") return errorResult("journal_field_of_research is supported only with journal_rank_source='ABDC'.");
        if (sort === "journalRank" && !journal_rank_source) return errorResult("sort='journalRank' requires journal_rank_source.");

        const allowedRanks: RankBucket[] = journal_ranks ?? (journal_rank_source === "SJR" ? ["Q1", "Q2"] : ["A*", "A", "B"]);
        if (journal_rank_source === "SJR" && allowedRanks.some((rank) => !["Q1", "Q2"].includes(rank))) {
          return errorResult("SJR rank filters accept only Q1 and Q2.");
        }
        if (journal_rank_source === "ABDC" && allowedRanks.some((rank) => !["A*", "A", "B"].includes(rank))) {
          return errorResult("ABDC rank filters accept only A*, A, and B.");
        }
        const rankFilter = journal_rank_source
          ? { source: journal_rank_source as RankSource, ranks: allowedRanks, subjectCategory: journal_subject_category, fieldOfResearch: journal_field_of_research }
          : null;
        const opts = { yearFrom: year_from ?? null, yearTo: year_to ?? null };
        const perQuery = await mapWithConcurrency(queries, FANOUT_CONCURRENCY, async (query) => {
          try {
            const result = await searchPapers(query, per_query, 0, opts);
            return { query, papers: result.papers };
          } catch {
            return { query, papers: [] as NormalizedPaper[] };
          }
        });

        const merged = new Map<string, { paper: NormalizedPaper; queries: Set<string> }>();
        for (const { query, papers } of perQuery) {
          for (const paper of papers) {
            if (!include_preprints && looksPreprint(paper)) continue;
            const key = paperKey(paper);
            const entry = merged.get(key);
            if (entry) {
              entry.queries.add(query);
              if (paper.abstract && !entry.paper.abstract) entry.paper = paper;
            } else {
              merged.set(key, { paper, queries: new Set([query]) });
            }
          }
        }

        const rankedItems = [...merged.values()].map((entry) => ({
          ...entry,
          journalRank: rankFilter ? bestVenueRank(entry.paper.venue, rankFilter) : null,
        }));
        const unmatchedRankCount = rankFilter ? rankedItems.filter((entry) => !entry.journalRank).length : 0;
        const items = rankFilter ? rankedItems.filter((entry) => entry.journalRank) : rankedItems;
        items.sort((a, b) => {
          if (sort === "journalRank") {
            const rankDiff = rankSortValue(a.journalRank!.rank) - rankSortValue(b.journalRank!.rank);
            if (rankDiff) return rankDiff;
          }
          if (sort === "recency") return (b.paper.year ?? 0) - (a.paper.year ?? 0) || (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0);
          if (sort === "citationCount") return (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0);
          return b.queries.size - a.queries.size || (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0);
        });

        const top = items.slice(0, limit);
        if (top.length === 0) {
          return errorResult(
            rankFilter
              ? `No papers matched the topic and local ${journal_rank_source} 2025 rank filter. ${unmatchedRankCount} fetched candidate(s) had no matching rank record; increase per_query or broaden the queries.`
              : `No papers found for ${queries.length} quer${queries.length > 1 ? "ies" : "y"}${year_from || year_to ? " in that year window" : ""}. Broaden the terms or widen the year range.`,
          );
        }

        const structured = {
          queries,
          year_from: year_from ?? null,
          year_to: year_to ?? null,
          sort,
          journal_rank_source: journal_rank_source ?? null,
          journal_rank_year: journal_rank_source ? rankSources()[journal_rank_source].year : null,
          journal_ranks: rankFilter?.ranks ?? null,
          journal_subject_category: journal_subject_category ?? null,
          journal_field_of_research: journal_field_of_research ?? null,
          rank_unmatched_candidates: unmatchedRankCount,
          count: top.length,
          results: top.map((entry) => ({
            ...toListItem(entry.paper),
            matched_queries: [...entry.queries],
            ...(entry.journalRank ? { journal_rank: entry.journalRank } : {}),
          })),
        };

        const lines = [
          `# Topic sweep — ${queries.length} variant(s), ${merged.size} unique papers${rankFilter ? ` · ${items.length} ranked matches` : ""}`,
          "",
          `Variants: ${queries.map((query) => `"${query}"`).join("; ")}${year_from || year_to ? ` · publication years ${year_from ?? "…"}–${year_to ?? "…"}` : ""} · sort: ${sort}${journal_rank_source ? ` · ${journal_rank_source} 2025 ${allowedRanks.join("/")}` : ""}${journal_subject_category ? ` · category: ${journal_subject_category}` : ""}`,
          "",
        ];
        top.forEach((entry, index) => {
          const journalRank = entry.journalRank
            ? ` · ${entry.journalRank.source} ${entry.journalRank.rank} (${entry.journalRank.year})${entry.journalRank.fieldOfResearch ? ` FoR ${entry.journalRank.fieldOfResearch}` : ""}`
            : "";
          const paperId = entry.paper.doi ?? entry.paper.paperId ?? entry.paper.openAlexId ?? "?";
          lines.push(`${index + 1}. **${entry.paper.title}** (${entry.paper.year ?? "n.d."}) · ${entry.paper.citationCount ?? "?"} cit · matched ${entry.queries.size}/${queries.length} variant(s)${journalRank} · ${authorNames(entry.paper, 3)} · id: \`${paperId}\`${looksPreprint(entry.paper) ? " · 📄 preprint" : ""}`);
        });
        if (rankFilter) {
          const source = rankSources()[journal_rank_source!];
          lines.push("", `Rank source: ${source.attribution} — ${source.sourceUrl}`, `Unmatched journal titles: ${unmatchedRankCount}`);
        }

        return buildResult(structured, lines.join("\n"), response_format as ResponseFormat);
      } catch (error) {
        return errorResult(`Error running topic sweep: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
