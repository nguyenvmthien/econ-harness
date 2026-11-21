/**
 * Shared constants for the research-discovery MCP server.
 */

// --- API base URLs ---
export const S2_GRAPH_BASE = "https://api.semanticscholar.org/graph/v1";
export const S2_REC_BASE = "https://api.semanticscholar.org/recommendations/v1";
export const OPENALEX_BASE = "https://api.openalex.org";
export const ELSEVIER_BASE = "https://api.elsevier.com";
// DOI prefixes served by ScienceDirect; only these are sent to the Elsevier Article Retrieval API.
export const ELSEVIER_DOI_PREFIXES = ["10.1016/", "10.1006/", "10.1053/", "10.1054/", "10.1067/"];

// --- Limits & networking ---
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const CHARACTER_LIMIT = 25_000; // Max characters in a single tool response.
export const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_RETRIES = 2; // Retries on 5xx / network errors, after the first try (keyed S2 429s use S2_KEYED_429_RETRIES).
export const S2_COOLDOWN_MS = 60_000; // Without a key, an S2 429 skips S2 for this long and goes straight to OpenAlex.
// Even with a key, S2 answers about half of requests with 429 regardless of client pacing
// (measured 2026-10-23: same rate at 1.1 s and 2 s spacing). When OpenAlex can answer the same
// call, a keyed 429 falls through to it at once and S2 is skipped for S2_KEYED_COOLDOWN_MS; only
// calls with no fallback (arXiv / S2 / CorpusId ids, S2 author ids) retry, where a retry usually succeeds.
export const S2_KEYED_COOLDOWN_MS = 10_000;
export const S2_KEYED_429_RETRIES = 4;
export const S2_KEYED_429_DELAY_MS = 1_100;
export const CACHE_TTL_MS = 60 * 60_000; // Successful GET responses are reused for one hour within a server process.
export const CACHE_MAX_ENTRIES = 1_000;
// Successful responses are also kept on disk and shared by every server process (each OMP session
// starts its own), so a paper looked up by one agent is instant for the next.
export const DISK_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;
export const DISK_CACHE_NOT_FOUND_TTL_MS = 24 * 60 * 60_000; // A cached 404 is re-checked after a day.
export const DISK_CACHE_DEFAULT_DIR = ".cache/research-discovery"; // Relative to the home directory.
// OpenAlex allows ~10 requests/s per client; measured 2026-10-23 at ~1 s latency: 10 in flight is
// clean, 16 in flight drew 429s on half the calls. All OpenAlex calls in a process share this cap.
export const OPENALEX_MAX_IN_FLIGHT = 8;
export const OPENALEX_OR_BATCH = 50; // OpenAlex allows up to 50 OR-values in a single filter.
export const ABSTRACT_SNIPPET_CHARS = 320; // Length of abstract snippets in list/search responses.

// network_expand fan-out caps (keep us within upstream rate limits).
export const EXPAND_PER_SEED_DEFAULT = 25;
export const EXPAND_PER_SEED_MAX = 50;

// Concurrency cap per fan-out helper. Upstream pressure is bounded globally by OPENALEX_MAX_IN_FLIGHT,
// so this only needs to keep each fan-out able to fill those slots.
export const FANOUT_CONCURRENCY = 8;

// Bibliographic coupling (papers that share references with the seed) — standalone caps.
export const COUPLING_MAX_REFS = 30; // how many of the seed's references to expand
export const COUPLING_PER_REF = 40; // citers fetched per reference
// Co-citation (papers co-cited alongside the seed) — standalone caps.
export const COCITATION_MAX_CITERS = 30; // how many of the seed's citing papers to expand
export const COCITATION_PER_CITER = 50; // references fetched per citing paper
// Smaller caps when these run *inside* network_expand (multiplied across seeds).
export const NETWORK_BIBLIO_REFS = 12;
export const NETWORK_BIBLIO_PERREF = 25;
export const NETWORK_BIBLIO_CITERS = 12;
export const NETWORK_BIBLIO_PERCITER = 30;

// --- Field selectors (kept narrow to save the agent's context budget) ---
export const S2_PAPER_FULL_FIELDS = [
  "paperId",
  "externalIds",
  "title",
  "abstract",
  "year",
  "publicationDate",
  "authors.authorId",
  "authors.name",
  "venue",
  "publicationVenue",
  "citationCount",
  "referenceCount",
  "influentialCitationCount",
  "fieldsOfStudy",
  "openAccessPdf",
  "url",
].join(",");

export const S2_PAPER_LIST_FIELDS = [
  "paperId",
  "externalIds",
  "title",
  "abstract",
  "year",
  "authors.authorId",
  "authors.name",
  "venue",
  "citationCount",
  "fieldsOfStudy",
  "openAccessPdf",
  "url",
].join(",");

export const S2_AUTHOR_FIELDS = ["authorId", "name", "affiliations", "homepage", "paperCount", "citationCount", "hIndex"].join(
  ",",
);

// OpenAlex "select" lists keep payloads small. Reference / related-work id arrays are
// fetched only by the calls that need them (references, similar).
export const OPENALEX_WORK_SELECT = [
  "id",
  "doi",
  "title",
  "publication_year",
  "publication_date",
  "authorships",
  "primary_location",
  "cited_by_count",
  "referenced_works_count",
  "topics",
  "open_access",
  "abstract_inverted_index",
].join(",");

export const OPENALEX_AUTHOR_SELECT = [
  "id",
  "display_name",
  "works_count",
  "cited_by_count",
  "summary_stats",
  "last_known_institutions",
  "affiliations",
  "ids",
].join(",");
