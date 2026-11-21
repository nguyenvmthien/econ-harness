/**
 * Presentation layer: turn NormalizedPaper / NormalizedAuthor data into the
 * compact structured items the tools return, render human-readable markdown,
 * and build the final CallToolResult (one text payload: markdown or compact JSON).
 */

import { CHARACTER_LIMIT } from "./constants.js";
import { ResponseFormat, type AuthorOut, type PaperDetail, type PaperListItem } from "./schemas.js";
import type { NormalizedAuthor, NormalizedPaper } from "./types.js";
import { authorNames, preferredId, truncate } from "./utils.js";

// --- NormalizedPaper -> structured items ---

export function toListItem(paper: NormalizedPaper): PaperListItem {
  return {
    paperId: paper.paperId,
    openAlexId: paper.openAlexId,
    doi: paper.doi,
    arxivId: paper.arxivId,
    title: paper.title,
    year: paper.year,
    authors: paper.authors,
    venue: paper.venue,
    citationCount: paper.citationCount,
    fieldsOfStudy: paper.fieldsOfStudy,
    openAccessPdf: paper.openAccessPdf,
    url: paper.url,
    abstractSnippet: paper.abstract ? truncate(paper.abstract) : null,
    source: paper.source,
  };
}

export function toDetail(paper: NormalizedPaper): PaperDetail {
  return {
    paperId: paper.paperId,
    openAlexId: paper.openAlexId,
    doi: paper.doi,
    arxivId: paper.arxivId,
    title: paper.title,
    year: paper.year,
    authors: paper.authors,
    venue: paper.venue,
    citationCount: paper.citationCount,
    fieldsOfStudy: paper.fieldsOfStudy,
    openAccessPdf: paper.openAccessPdf,
    url: paper.url,
    abstract: paper.abstract,
    abstractSource: paper.abstractSource,
    referenceCount: paper.referenceCount,
    influentialCitationCount: paper.influentialCitationCount,
    source: paper.source,
  };
}

export function toAuthorOut(author: NormalizedAuthor): AuthorOut {
  return {
    authorId: author.authorId,
    openAlexId: author.openAlexId,
    name: author.name,
    affiliations: author.affiliations,
    homepage: author.homepage,
    paperCount: author.paperCount,
    citationCount: author.citationCount,
    hIndex: author.hIndex,
    source: author.source,
  };
}

// --- Markdown rendering ---

export function paperLineMarkdown(paper: NormalizedPaper, index?: number): string {
  const bullet = index !== undefined ? `${index}. ` : "- ";
  const year = paper.year ?? "n.d.";
  const cites = paper.citationCount !== null ? ` · ${paper.citationCount} citations` : "";
  const idHint = `\`${preferredId(paper)}\``;
  const venue = paper.venue ? ` _${paper.venue}_,` : "";
  const oa = paper.openAccessPdf ? " · 📄 OA PDF" : "";
  return `${bullet}**${paper.title}** (${year})${cites}\n   ${authorNames(paper)}.${venue} id: ${idHint}${oa}`;
}

export function renderPaperList(heading: string, papers: NormalizedPaper[], subtitle?: string): string {
  const lines = [`# ${heading}`, ""];
  if (subtitle) lines.push(subtitle, "");
  if (papers.length === 0) {
    lines.push("_No papers found._");
    return lines.join("\n");
  }
  papers.forEach((p, i) => lines.push(paperLineMarkdown(p, i + 1)));
  return lines.join("\n");
}

export function renderAuthor(author: NormalizedAuthor): string {
  const lines = [`# ${author.name}`, ""];
  if (author.affiliations.length) lines.push(`- **Affiliation(s)**: ${author.affiliations.join("; ")}`);
  if (author.paperCount !== null) lines.push(`- **Papers**: ${author.paperCount}`);
  if (author.citationCount !== null) lines.push(`- **Citations**: ${author.citationCount}`);
  if (author.hIndex !== null) lines.push(`- **h-index**: ${author.hIndex}`);
  if (author.homepage) lines.push(`- **Homepage**: ${author.homepage}`);
  const id = author.authorId ?? author.openAlexId;
  if (id) lines.push(`- **id**: \`${id}\` (${author.source})`);
  return lines.join("\n");
}

// --- Result building ---

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Build a successful tool result: `markdown` for response_format=markdown, otherwise
 * compact JSON of `structured`. Only one representation is returned — MCP clients
 * (omp included) forward structuredContent to the model as well, so sending both
 * quadrupled the payload of list tools.
 */
export function buildResult(
  structured: Record<string, unknown>,
  markdown: string,
  format: ResponseFormat,
): ToolResult {
  let text = format === ResponseFormat.JSON ? JSON.stringify(structured) : markdown;
  if (text.length > CHARACTER_LIMIT) {
    text =
      `${text.slice(0, CHARACTER_LIMIT)}\n\n…[response truncated at ${CHARACTER_LIMIT} characters. ` +
      `Use a smaller 'limit', pagination via 'offset', or response_format='json' for compact data.]`;
  }
  return { content: [{ type: "text", text }] };
}

/** Build an actionable error result (no structuredContent, isError=true). */
export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
