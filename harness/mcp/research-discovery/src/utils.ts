/**
 * Pure helpers: identifier normalization, abstract reconstruction,
 * source-to-normalized converters, de-duplication, and small formatters.
 * No network access here — keep this module easy to unit-test.
 */

import { ABSTRACT_SNIPPET_CHARS } from "./constants.js";
import type {
  NormalizedAuthor,
  NormalizedAuthorRef,
  NormalizedId,
  NormalizedPaper,
  OpenAlexAuthor,
  OpenAlexWork,
  S2Author,
  S2Paper,
} from "./types.js";

// ---------------------------------------------------------------------------
// Identifier handling
// ---------------------------------------------------------------------------

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+)\b/i;
const OPENALEX_ID_RE = /^[Ww]\d{4,}$/;
const ARXIV_PREFIX_RE = /^arxiv:\s*/i;
const S2_SHA_RE = /^[0-9a-f]{40}$/i;

/** Strip a DOI down to its bare lower-cased form (no scheme/host/`doi:` prefix). */
export function bareDoi(input: string): string | null {
  const cleaned = input.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  const match = cleaned.match(DOI_RE);
  return match ? match[1]!.toLowerCase().replace(/[).,;]+$/, "") : null;
}

/** Strip the OpenAlex URL prefix, returning a bare work/author id like "W123" / "A123". */
export function bareOpenAlexId(input: string): string {
  return input.trim().replace(/^https?:\/\/openalex\.org\//i, "").replace(/^openalex:/i, "");
}

/**
 * Normalize a flexible paper identifier (DOI, Semantic Scholar id, arXiv id, or
 * OpenAlex work id) into the route tokens each API expects. DOI is preferred as
 * the cross-source key. Unknown formats fall back to treating the input as a
 * raw Semantic Scholar id.
 */
export function normalizeId(rawInput: string): NormalizedId {
  const raw = rawInput.trim();

  // DOI (bare, doi:, or https://doi.org/...)
  const doi = bareDoi(raw);
  if (doi) {
    return { raw, kind: "doi", doi, s2: `DOI:${doi}`, openalex: `https://doi.org/${doi}` };
  }

  // OpenAlex work id (W…)
  if (OPENALEX_ID_RE.test(bareOpenAlexId(raw))) {
    const id = bareOpenAlexId(raw).toUpperCase();
    return { raw, kind: "openalex", doi: null, s2: null, openalex: id };
  }

  // arXiv id
  if (ARXIV_PREFIX_RE.test(raw) || /^\d{4}\.\d{4,5}(v\d+)?$/.test(raw)) {
    const id = raw.replace(ARXIV_PREFIX_RE, "");
    return { raw, kind: "arxiv", doi: null, s2: `ARXIV:${id}`, openalex: null };
  }

  // CorpusId:NNN
  if (/^corpusid:/i.test(raw)) {
    return { raw, kind: "corpusid", doi: null, s2: raw.replace(/^corpusid:/i, "CorpusId:"), openalex: null };
  }

  // PubMed id (PMID:NNN)
  if (/^pmid:/i.test(raw)) {
    const id = raw.replace(/^pmid:/i, "");
    return { raw, kind: "pmid", doi: null, s2: `PMID:${id}`, openalex: `pmid:${id}` };
  }

  // Bare 40-char Semantic Scholar sha, or any other token treated as an S2 id.
  const kind = S2_SHA_RE.test(raw) ? "s2" : "s2";
  return { raw, kind, doi: null, s2: raw, openalex: null };
}

// ---------------------------------------------------------------------------
// Abstract reconstruction (OpenAlex stores an inverted index)
// ---------------------------------------------------------------------------

export function reconstructAbstract(inverted: Record<string, number[]> | null | undefined): string | null {
  if (!inverted) return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) {
      slots[pos] = word;
    }
  }
  const text = slots.filter((w) => w !== undefined).join(" ").trim();
  return text.length > 0 ? text : null;
}

// ---------------------------------------------------------------------------
// Converters: upstream shape -> NormalizedPaper / NormalizedAuthor
// ---------------------------------------------------------------------------

function s2VenueName(paper: S2Paper): string | null {
  if (paper.publicationVenue?.name) return paper.publicationVenue.name;
  if (typeof paper.venue === "string" && paper.venue.length > 0) return paper.venue;
  return null;
}

export function fromS2Paper(paper: S2Paper): NormalizedPaper {
  const ext = paper.externalIds ?? {};
  const authors: NormalizedAuthorRef[] = (paper.authors ?? []).map((a) => ({
    authorId: a.authorId ?? null,
    openAlexId: null,
    name: a.name ?? "Unknown",
  }));
  return {
    paperId: paper.paperId ?? null,
    openAlexId: null,
    doi: ext.DOI ? ext.DOI.toLowerCase() : null,
    arxivId: ext.ArXiv ? String(ext.ArXiv) : null,
    title: paper.title ?? "(untitled)",
    year: paper.year ?? null,
    authors,
    venue: s2VenueName(paper),
    citationCount: paper.citationCount ?? null,
    referenceCount: paper.referenceCount ?? null,
    influentialCitationCount: paper.influentialCitationCount ?? null,
    fieldsOfStudy: paper.fieldsOfStudy ?? [],
    abstract: paper.abstract ?? null,
    abstractSource: paper.abstract ? "semantic_scholar" : null,
    openAccessPdf: paper.openAccessPdf?.url ?? null,
    url: paper.url ?? (ext.DOI ? `https://doi.org/${String(ext.DOI).toLowerCase()}` : null),
    source: "semantic_scholar",
  };
}

export function fromOpenAlexWork(work: OpenAlexWork): NormalizedPaper {
  const authors: NormalizedAuthorRef[] = (work.authorships ?? []).map((a) => ({
    authorId: null,
    openAlexId: a.author?.id ? bareOpenAlexId(a.author.id) : null,
    name: a.author?.display_name ?? a.raw_author_name ?? "Unknown",
  }));
  const doi = work.doi ? bareDoi(work.doi) : null;
  const pdf = work.primary_location?.pdf_url ?? work.open_access?.oa_url ?? null;
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  return {
    paperId: null,
    openAlexId: work.id ? bareOpenAlexId(work.id) : null,
    doi,
    arxivId: null,
    title: work.title ?? work.display_name ?? "(untitled)",
    year: work.publication_year ?? null,
    authors,
    venue: work.primary_location?.source?.display_name ?? null,
    citationCount: work.cited_by_count ?? null,
    referenceCount: work.referenced_works_count ?? (work.referenced_works?.length ?? null),
    influentialCitationCount: null,
    fieldsOfStudy: (work.topics ?? []).map((t) => t.display_name).filter((n): n is string => Boolean(n)),
    abstract,
    abstractSource: abstract ? "openalex" : null,
    openAccessPdf: pdf,
    url: doi ? `https://doi.org/${doi}` : work.primary_location?.landing_page_url ?? (work.id ?? null),
    source: "openalex",
  };
}

export function fromS2Author(author: S2Author): NormalizedAuthor {
  return {
    authorId: author.authorId ?? null,
    openAlexId: null,
    name: author.name ?? "Unknown",
    affiliations: author.affiliations ?? [],
    homepage: author.homepage ?? null,
    paperCount: author.paperCount ?? null,
    citationCount: author.citationCount ?? null,
    hIndex: author.hIndex ?? null,
    source: "semantic_scholar",
  };
}

export function fromOpenAlexAuthor(author: OpenAlexAuthor): NormalizedAuthor {
  const affiliations = [
    ...(author.last_known_institutions ?? []).map((i) => i.display_name),
    ...(author.affiliations ?? []).map((a) => a.institution?.display_name),
  ].filter((n): n is string => Boolean(n));
  return {
    authorId: null,
    openAlexId: author.id ? bareOpenAlexId(author.id) : null,
    name: author.display_name ?? "Unknown",
    affiliations: [...new Set(affiliations)],
    homepage: null,
    paperCount: author.works_count ?? null,
    citationCount: author.cited_by_count ?? null,
    hIndex: author.summary_stats?.h_index ?? null,
    source: "openalex",
  };
}

// ---------------------------------------------------------------------------
// De-duplication
// ---------------------------------------------------------------------------

/** Key used to detect the same paper across sources: DOI first, else normalized title. */
export function paperKey(paper: NormalizedPaper): string {
  if (paper.doi) return `doi:${paper.doi}`;
  if (paper.openAlexId) return `oa:${paper.openAlexId}`;
  if (paper.paperId) return `s2:${paper.paperId}`;
  return `title:${normalizeTitle(paper.title)}`;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Merge two records of the same paper, preferring more complete / S2-sourced data. */
function mergePapers(a: NormalizedPaper, b: NormalizedPaper): NormalizedPaper {
  const primary = a.source === "semantic_scholar" ? a : b.source === "semantic_scholar" ? b : a;
  const secondary = primary === a ? b : a;
  return {
    ...secondary,
    ...Object.fromEntries(Object.entries(primary).filter(([, v]) => v !== null && v !== undefined)),
    // Keep the richest scalar fields explicitly.
    paperId: primary.paperId ?? secondary.paperId,
    openAlexId: primary.openAlexId ?? secondary.openAlexId,
    doi: primary.doi ?? secondary.doi,
    abstract: primary.abstract ?? secondary.abstract,
    abstractSource: primary.abstract ? primary.abstractSource : secondary.abstractSource,
    openAccessPdf: primary.openAccessPdf ?? secondary.openAccessPdf,
    citationCount: primary.citationCount ?? secondary.citationCount,
    authors: primary.authors.length >= secondary.authors.length ? primary.authors : secondary.authors,
    fieldsOfStudy: primary.fieldsOfStudy.length >= secondary.fieldsOfStudy.length ? primary.fieldsOfStudy : secondary.fieldsOfStudy,
  } as NormalizedPaper;
}

/** De-duplicate a list of papers by DOI/title, merging the duplicates. */
export function dedupePapers(papers: NormalizedPaper[]): NormalizedPaper[] {
  const map = new Map<string, NormalizedPaper>();
  for (const paper of papers) {
    const key = paperKey(paper);
    const existing = map.get(key);
    map.set(key, existing ? mergePapers(existing, paper) : paper);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

export function truncate(text: string, max = ABSTRACT_SNIPPET_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function authorNames(paper: NormalizedPaper, max = 4): string {
  const names = paper.authors.map((a) => a.name);
  if (names.length === 0) return "Unknown authors";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} (+${names.length - max} more)`;
}

/** Run `fn` over `items` with a bounded number of concurrent in-flight promises. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(concurrency, items.length))).fill(0).map(async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** The most useful single identifier to echo back to the agent for follow-up calls. */
export function preferredId(paper: NormalizedPaper): string {
  if (paper.doi) return paper.doi;
  if (paper.paperId) return paper.paperId;
  if (paper.openAlexId) return paper.openAlexId;
  if (paper.arxivId) return `arXiv:${paper.arxivId}`;
  return paper.title;
}
