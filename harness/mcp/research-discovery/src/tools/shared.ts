/**
 * Small helpers shared across tool modules: friendly error messages and
 * pagination-metadata construction.
 */

import { ApiError } from "../apiClient.js";
import type { PagedAuthors, PagedPapers } from "../discovery.js";

/** Turn an error into an actionable, agent-facing message that suggests next steps. */
export function friendlyError(error: unknown, subject: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return `No match for ${subject}. Try a DOI (e.g. '10.1126/science.1244693'), an exact title, or first use paper_search to find the right id.`;
    }
    if (error.status === 429) {
      return `Could not resolve ${subject}: ${error.source} is rate-limited and the OpenAlex fallback cannot look up this identifier type. Use a DOI or an OpenAlex 'W…' id, or retry in a minute.`;
    }
    if (error.status === 400) {
      return `${subject} was rejected as malformed by ${error.source}. Check the identifier format.`;
    }
    return `Upstream error from ${error.source} while resolving ${subject}: ${error.message}`;
  }
  return `Unexpected error resolving ${subject}: ${error instanceof Error ? error.message : String(error)}`;
}

export interface PaginationOut {
  count: number;
  offset: number;
  total: number | null;
  hasMore: boolean;
  nextOffset: number | null;
}

export function paginationOf(paged: PagedPapers | PagedAuthors, offset: number): PaginationOut {
  const count = "papers" in paged ? paged.papers.length : paged.authors.length;
  return {
    count,
    offset,
    total: paged.total,
    hasMore: paged.hasMore,
    nextOffset: paged.hasMore ? offset + count : null,
  };
}
