/**
 * Paper-centric tools: search, get, references (Earlier Work), citations (Later Work),
 * and bibliometric neighbors (coupling + co-citation). "Similar Work" is
 * network_expand with one seed and include=["similar"].
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  bibliographicCoupling,
  coCitation,
  getCitations,
  getPaper,
  getReferences,
  looksLikeId,
  normalizeId,
  searchPapers,
  type PaperSort,
  type ScoredPaper,
} from "../discovery.js";
import { buildResult, errorResult, renderPaperList, toDetail, toListItem } from "../format.js";
import { limitInput, offsetInput, paperIdInput, responseFormatInput, yearFromInput, yearToInput } from "../schemas.js";
import { friendlyError, paginationOf } from "./shared.js";

const sortInput = z
  .enum(["relevance", "year", "citationCount"])
  .default("relevance")
  .describe(
    "Ordering: 'relevance' (Semantic Scholar default order), 'year' (newest first), or 'citationCount' (most cited first).",
  );

export function registerPaperTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // paper_search
  // -------------------------------------------------------------------------
  server.registerTool(
    "paper_search",
    {
      title: "Search papers (pick a seed)",
      description: `Find candidate papers by free-text title/keywords OR resolve a direct identifier. This is how you pick a SEED paper before exploring its network.

If the query is itself an identifier (DOI, Semantic Scholar id, arXiv id, OpenAlex 'W…' id), the exact paper is resolved and returned as a single result; otherwise a relevance keyword search runs.

Examples:
  - "graph neural networks for molecules" -> keyword search.
  - "10.1126/science.1244693" -> resolves that exact paper.
  - Don't use to list a paper's references (use paper_references) or citing works (use paper_citations).`,
      inputSchema: {
        query: z.string().min(2).max(300).describe("Keywords/title, or a DOI/identifier."),
        year_from: yearFromInput,
        year_to: yearToInput,
        limit: limitInput,
        offset: offsetInput,
        response_format: responseFormatInput,
      },
      annotations: { title: "Search papers", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, year_from, year_to, limit, offset, response_format }) => {
      try {
        const normId = normalizeId(query);
        if (offset === 0 && looksLikeId(normId)) {
          // Direct identifier lookup -> single seed result.
          const paper = await getPaper(normId);
          const structured = {
            query,
            source: paper.source,
            pagination: { count: 1, offset: 0, total: 1, hasMore: false, nextOffset: null },
            results: [toListItem(paper)],
          };
          const md = renderPaperList(`Resolved paper for '${query}'`, [paper], `Source: ${paper.source}`);
          return buildResult(structured, md, response_format);
        }
        const paged = await searchPapers(query, limit, offset, { yearFrom: year_from ?? null, yearTo: year_to ?? null });
        const structured = {
          query,
          source: paged.source,
          pagination: paginationOf(paged, offset),
          results: paged.papers.map(toListItem),
        };
        const subtitle = `${paged.total ?? paged.papers.length} matches · source: ${paged.source}`;
        const md = renderPaperList(`Search: '${query}'`, paged.papers, subtitle);
        return buildResult(structured, md, response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `query '${query}'`));
      }
    },
  );

  // -------------------------------------------------------------------------
  // paper_get
  // -------------------------------------------------------------------------
  server.registerTool(
    "paper_get",
    {
      title: "Get full paper metadata",
      description: `Fetch complete metadata for ONE paper id: full abstract (with abstractSource; Elsevier/ScienceDirect fills abstracts Semantic Scholar and OpenAlex elide), authors (with ids), venue, year, citation/reference counts, fields of study, and an open-access PDF url when available.

Examples:
  - paper_id="10.1126/science.1244693" -> that paper's full record.
  - Use after paper_search to get the abstract/authors of a chosen seed.`,
      inputSchema: { paper_id: paperIdInput, response_format: responseFormatInput },
      annotations: { title: "Get paper", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ paper_id, response_format }) => {
      try {
        const paper = await getPaper(normalizeId(paper_id));
        const detail = toDetail(paper);
        const lines = [
          `# ${paper.title}`,
          "",
          `- **Year**: ${paper.year ?? "n.d."}  ·  **Venue**: ${paper.venue ?? "—"}`,
          `- **Authors**: ${paper.authors.map((a) => a.name).join(", ") || "—"}`,
          `- **Citations**: ${paper.citationCount ?? "—"}  ·  **References**: ${paper.referenceCount ?? "—"}  ·  **Influential citations**: ${paper.influentialCitationCount ?? "—"}`,
          `- **Fields**: ${paper.fieldsOfStudy.join(", ") || "—"}`,
          `- **DOI**: ${paper.doi ?? "—"}  ·  **S2 id**: ${paper.paperId ?? "—"}  ·  **OpenAlex**: ${paper.openAlexId ?? "—"}`,
          paper.openAccessPdf ? `- **OA PDF**: ${paper.openAccessPdf}` : `- **URL**: ${paper.url ?? "—"}`,
          "",
          paper.abstractSource ? `## Abstract (source: ${paper.abstractSource})` : "## Abstract",
          paper.abstract ?? "_No abstract available._",
        ];
        return buildResult({ source: paper.source, paper: detail }, lines.join("\n"), response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `paper '${paper_id}'`));
      }
    },
  );

  // -------------------------------------------------------------------------
  // paper_references  (Earlier Work)
  // -------------------------------------------------------------------------
  server.registerTool(
    "paper_references",
    {
      title: "Earlier Work (references)",
      description: `List the papers CITED BY a seed paper — its "Earlier Work" / bibliography. Paginated.

Examples:
  - "What foundational work does <DOI> build on?" -> paper_references then read titles/years.
  - Page with offset to walk a long bibliography.`,
      inputSchema: { paper_id: paperIdInput, limit: limitInput, offset: offsetInput, response_format: responseFormatInput },
      annotations: { title: "Get references", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ paper_id, limit, offset, response_format }) => {
      try {
        const paged = await getReferences(normalizeId(paper_id), limit, offset);
        const structured = {
          paper_id,
          source: paged.source,
          pagination: paginationOf(paged, offset),
          references: paged.papers.map(toListItem),
        };
        const md = renderPaperList(`Earlier Work (references) of ${paper_id}`, paged.papers, `source: ${paged.source}`);
        return buildResult(structured, md, response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `references of '${paper_id}'`));
      }
    },
  );

  // -------------------------------------------------------------------------
  // paper_citations  (Later Work)
  // -------------------------------------------------------------------------
  server.registerTool(
    "paper_citations",
    {
      title: "Later Work (citations)",
      description: `List the papers that CITE a seed paper — its "Later Work". Paginated and sortable.

Examples:
  - "Most-cited paper that cites <DOI>?" -> sort='citationCount', read the first result.
  - "Newest follow-ups to <DOI>?" -> sort='year'.`,
      inputSchema: { paper_id: paperIdInput, limit: limitInput, offset: offsetInput, sort: sortInput, response_format: responseFormatInput },
      annotations: { title: "Get citations", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ paper_id, limit, offset, sort, response_format }) => {
      try {
        const paged = await getCitations(normalizeId(paper_id), limit, offset, sort as PaperSort);
        const structured = {
          paper_id,
          source: paged.source,
          sort,
          pagination: paginationOf(paged, offset),
          citations: paged.papers.map(toListItem),
        };
        const md = renderPaperList(`Later Work (citations) of ${paper_id}`, paged.papers, `sort: ${sort} · source: ${paged.source}`);
        return buildResult(structured, md, response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `citations of '${paper_id}'`));
      }
    },
  );

  // -------------------------------------------------------------------------
  // paper_related  (bibliographic coupling + co-citation)
  // -------------------------------------------------------------------------
  server.registerTool(
    "paper_related",
    {
      title: "Bibliometric neighbors (coupling + co-citation)",
      description: `Find a seed's bibliometric neighbors using citation-graph structure — more precise than recommendation-based "similar work" (network_expand include=["similar"]).

  • Bibliographic COUPLING: papers that share references with the seed (score = number of the seed's references they also cite). Surfaces topical SIBLINGS — often very recent work on the same problem that doesn't cite the seed yet.
  • CO-CITATION: papers cited ALONGSIDE the seed by the same later papers (score = number of the seed's citers that also cite them). Surfaces the FOUNDATIONS the field reads together with the seed.

This is heavier than other tools (it fans out across the seed's references/citations), so it is capped internally.

Examples:
  - "Recent papers tackling the same problem as <DOI>, even if they don't cite it" -> method='coupling'.
  - "Which classic papers are read together with <DOI>?" -> method='cocitation'.`,
      inputSchema: {
        paper_id: paperIdInput,
        method: z.enum(["coupling", "cocitation", "both"]).default("both").describe("Which bibliometric relation(s) to compute."),
        limit: limitInput.describe("Max neighbors per method (1-100, default 15).").default(15),
        response_format: responseFormatInput,
      },
      annotations: { title: "Bibliometric neighbors", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ paper_id, method, limit, response_format }) => {
      try {
        const normId = normalizeId(paper_id);
        const wantCoupling = method === "coupling" || method === "both";
        const wantCocitation = method === "cocitation" || method === "both";
        const [coupling, cocitation] = await Promise.all([
          wantCoupling ? bibliographicCoupling(normId, { limit }) : Promise.resolve<ScoredPaper[]>([]),
          wantCocitation ? coCitation(normId, { limit }) : Promise.resolve<ScoredPaper[]>([]),
        ]);

        if (coupling.length === 0 && cocitation.length === 0) {
          return errorResult(
            `No bibliometric neighbors found for '${paper_id}'. The seed may have too few indexed references/citations. Verify it with paper_get, or try network_expand with include=["similar"].`,
          );
        }

        const scoredItem = (s: ScoredPaper) => ({ ...toListItem(s.paper), score: s.score });
        const structured = {
          paper_id,
          method,
          coupling: coupling.map(scoredItem),
          cocitation: cocitation.map(scoredItem),
        };

        const lines: string[] = [`# Bibliometric neighbors of ${paper_id}`, ""];
        if (wantCoupling) {
          lines.push(`## Bibliographic coupling (shared references) — ${coupling.length}`);
          coupling.forEach((s, i) =>
            lines.push(`${i + 1}. **${s.paper.title}** (${s.paper.year ?? "n.d."}) · shares ${s.score} ref(s) · ${s.paper.citationCount ?? "?"} cit · id: \`${s.paper.doi ?? s.paper.paperId ?? s.paper.openAlexId ?? "?"}\``),
          );
          lines.push("");
        }
        if (wantCocitation) {
          lines.push(`## Co-citation (read alongside the seed) — ${cocitation.length}`);
          cocitation.forEach((s, i) =>
            lines.push(`${i + 1}. **${s.paper.title}** (${s.paper.year ?? "n.d."}) · co-cited ${s.score}× · ${s.paper.citationCount ?? "?"} cit · id: \`${s.paper.doi ?? s.paper.paperId ?? s.paper.openAlexId ?? "?"}\``),
          );
        }
        return buildResult(structured, lines.join("\n"), response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `bibliometric neighbors for '${paper_id}'`));
      }
    },
  );
}
