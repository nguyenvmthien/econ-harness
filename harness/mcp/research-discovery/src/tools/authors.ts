/**
 * Author tools: search, get, and papers.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAuthor, getAuthorPapers, searchAuthors, type PaperSort } from "../discovery.js";
import { buildResult, errorResult, renderAuthor, renderPaperList, toAuthorOut, toListItem } from "../format.js";
import { limitInput, offsetInput, responseFormatInput } from "../schemas.js";
import { friendlyError, paginationOf } from "./shared.js";

const authorIdInput = z
  .string()
  .min(1)
  .describe(
    "Author identifier: a Semantic Scholar author id (numeric string, e.g. '1741101') or an OpenAlex author id (e.g. 'A5023888391'). Get one from author_search.",
  );

const paperSortInput = z
  .enum(["relevance", "year", "citationCount"])
  .default("citationCount")
  .describe("Ordering of the author's papers: 'citationCount' (default), 'year' (newest first), or 'relevance'.");

export function registerAuthorTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // author_search
  // -------------------------------------------------------------------------
  server.registerTool(
    "author_search",
    {
      title: "Search authors",
      description: `Find a researcher by name. Returns candidates with their id, name, paper count, h-index, citation count, and affiliations — use this to disambiguate and grab an authorId for the other author_* tools.

Examples:
  - name="Yoshua Bengio" -> pick the candidate with the matching affiliation/h-index.`,
      inputSchema: { name: z.string().min(2).max(120).describe("Author name (partial allowed)."), limit: limitInput, offset: offsetInput, response_format: responseFormatInput },
      annotations: { title: "Search authors", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ name, limit, offset, response_format }) => {
      try {
        const paged = await searchAuthors(name, limit, offset);
        if (paged.authors.length === 0) {
          return errorResult(`No authors found matching '${name}'. Try a different spelling or a fuller name.`);
        }
        const structured = { name, source: paged.source, pagination: paginationOf(paged, offset), authors: paged.authors.map(toAuthorOut) };
        const lines = [`# Authors matching '${name}' (source: ${paged.source})`, ""];
        paged.authors.forEach((a, i) => {
          const id = a.authorId ?? a.openAlexId ?? "?";
          lines.push(
            `${i + 1}. **${a.name}** — id: \`${id}\` · papers: ${a.paperCount ?? "?"} · h-index: ${a.hIndex ?? "?"} · citations: ${a.citationCount ?? "?"}${a.affiliations.length ? ` · ${a.affiliations.slice(0, 2).join("; ")}` : ""}`,
          );
        });
        return buildResult(structured, lines.join("\n"), response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `author '${name}'`));
      }
    },
  );

  // -------------------------------------------------------------------------
  // author_get
  // -------------------------------------------------------------------------
  server.registerTool(
    "author_get",
    {
      title: "Get author detail",
      description: `Fetch full detail for ONE author id: name, affiliations, paper count, citation count, h-index, and homepage.`,
      inputSchema: { author_id: authorIdInput, response_format: responseFormatInput },
      annotations: { title: "Get author", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ author_id, response_format }) => {
      try {
        const author = await getAuthor(author_id);
        return buildResult({ source: author.source, author: toAuthorOut(author) }, renderAuthor(author), response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `author id '${author_id}'`));
      }
    },
  );

  // -------------------------------------------------------------------------
  // author_papers
  // -------------------------------------------------------------------------
  server.registerTool(
    "author_papers",
    {
      title: "An author's papers",
      description: `List papers written by an author (the "These Authors" view), paginated and sortable.

Examples:
  - "Most-cited paper by author X?" -> sort='citationCount', read first result.
  - "What did author X publish recently?" -> sort='year'.`,
      inputSchema: { author_id: authorIdInput, limit: limitInput, offset: offsetInput, sort: paperSortInput, response_format: responseFormatInput },
      annotations: { title: "Get author papers", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ author_id, limit, offset, sort, response_format }) => {
      try {
        const paged = await getAuthorPapers(author_id, limit, offset, sort as PaperSort);
        const structured = { author_id, source: paged.source, sort, pagination: paginationOf(paged, offset), papers: paged.papers.map(toListItem) };
        const md = renderPaperList(`Papers by ${author_id}`, paged.papers, `sort: ${sort} · source: ${paged.source}`);
        return buildResult(structured, md, response_format);
      } catch (error) {
        return errorResult(friendlyError(error, `papers of author '${author_id}'`));
      }
    },
  );
}
