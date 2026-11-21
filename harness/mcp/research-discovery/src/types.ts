/**
 * Shared TypeScript types: the normalized shapes the server exposes, plus
 * partial shapes of the upstream Semantic Scholar / OpenAlex / Elsevier JSON we consume.
 */

export type DataSource = "semantic_scholar" | "openalex";

/** API that supplied a paper's abstract. Elsevier only fills abstracts the other two lack. */
export type AbstractSource = DataSource | "elsevier";

/** A single author as attached to a paper. */
export interface NormalizedAuthorRef {
  authorId: string | null; // Semantic Scholar author id when available.
  openAlexId: string | null; // OpenAlex author id (e.g. "A5023888391") when available.
  name: string;
}

/** A paper in the server's clean, source-agnostic shape. */
export interface NormalizedPaper {
  paperId: string | null; // Semantic Scholar paper id (sha) if known.
  openAlexId: string | null; // OpenAlex work id (e.g. "W1981213426") if known.
  doi: string | null; // Lower-cased bare DOI (no URL prefix), the cross-source key.
  arxivId: string | null;
  title: string;
  year: number | null;
  authors: NormalizedAuthorRef[];
  venue: string | null;
  citationCount: number | null;
  referenceCount: number | null;
  influentialCitationCount: number | null;
  fieldsOfStudy: string[];
  abstract: string | null;
  abstractSource: AbstractSource | null;
  openAccessPdf: string | null;
  url: string | null;
  source: DataSource;
}

/** A normalized author/researcher. */
export interface NormalizedAuthor {
  authorId: string | null;
  openAlexId: string | null;
  name: string;
  affiliations: string[];
  homepage: string | null;
  paperCount: number | null;
  citationCount: number | null;
  hIndex: number | null;
  source: DataSource;
}

/** Result of normalizing a flexible paper identifier. */
export interface NormalizedId {
  raw: string;
  kind: "doi" | "arxiv" | "openalex" | "s2" | "corpusid" | "pmid" | "url";
  /** Identifier token formatted for the Semantic Scholar `/paper/{id}` route, or null if unsupported. */
  s2: string | null;
  /** Identifier token formatted for the OpenAlex `/works/{id}` route, or null if unsupported. */
  openalex: string | null;
  /** Bare lower-cased DOI when the id is (or carries) one. */
  doi: string | null;
}

// ---------------------------------------------------------------------------
// Partial upstream shapes (only the fields we read).
// ---------------------------------------------------------------------------

export interface S2ExternalIds {
  DOI?: string;
  ArXiv?: string;
  CorpusId?: number | string;
  PubMed?: string;
  [key: string]: unknown;
}

export interface S2AuthorRef {
  authorId: string | null;
  name: string;
}

export interface S2Paper {
  paperId?: string;
  externalIds?: S2ExternalIds | null;
  title?: string | null;
  abstract?: string | null;
  year?: number | null;
  publicationDate?: string | null;
  authors?: S2AuthorRef[];
  venue?: string | null;
  publicationVenue?: { name?: string | null } | null;
  citationCount?: number | null;
  referenceCount?: number | null;
  influentialCitationCount?: number | null;
  fieldsOfStudy?: string[] | null;
  openAccessPdf?: { url?: string | null } | null;
  url?: string | null;
}

export interface S2PaperSearchResponse {
  total?: number;
  offset?: number;
  next?: number;
  data?: S2Paper[];
}

export interface S2ReferenceEdge {
  citedPaper?: S2Paper;
}

export interface S2CitationEdge {
  citingPaper?: S2Paper;
}

export interface S2EdgeListResponse<T> {
  offset?: number;
  next?: number;
  data?: T[];
}

export interface S2RecommendationResponse {
  recommendedPapers?: S2Paper[];
}

export interface S2Author {
  authorId?: string;
  name?: string;
  affiliations?: string[] | null;
  homepage?: string | null;
  paperCount?: number | null;
  citationCount?: number | null;
  hIndex?: number | null;
}

export interface S2AuthorSearchResponse {
  total?: number;
  offset?: number;
  next?: number;
  data?: S2Author[];
}

export interface S2AuthorPapersResponse {
  offset?: number;
  next?: number;
  data?: S2Paper[];
}

export interface OpenAlexAuthorship {
  author?: { id?: string | null; display_name?: string | null };
  raw_author_name?: string | null;
}

export interface OpenAlexLocation {
  source?: { display_name?: string | null } | null;
  pdf_url?: string | null;
  landing_page_url?: string | null;
}

export interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  authorships?: OpenAlexAuthorship[];
  primary_location?: OpenAlexLocation | null;
  cited_by_count?: number | null;
  referenced_works?: string[];
  referenced_works_count?: number | null;
  related_works?: string[];
  topics?: { display_name?: string | null }[];
  open_access?: { oa_url?: string | null; is_oa?: boolean } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export interface OpenAlexMeta {
  count?: number;
  page?: number;
  per_page?: number;
}

export interface OpenAlexListResponse<T> {
  meta?: OpenAlexMeta;
  results?: T[];
}

export interface OpenAlexAuthor {
  id?: string;
  display_name?: string;
  works_count?: number | null;
  cited_by_count?: number | null;
  summary_stats?: { h_index?: number | null; i10_index?: number | null } | null;
  last_known_institutions?: { display_name?: string | null }[];
  affiliations?: { institution?: { display_name?: string | null } }[];
  ids?: { openalex?: string; orcid?: string } | null;
}

/** ScienceDirect Article Retrieval API (`/content/article/doi/…?view=META_ABS`), fields we read. */
export interface ElsevierArticleResponse {
  "full-text-retrieval-response"?: {
    coredata?: { "dc:description"?: unknown } | null;
  } | null;
}
