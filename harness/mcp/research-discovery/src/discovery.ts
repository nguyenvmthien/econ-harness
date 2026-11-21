/**
 * Discovery engine: high-level data operations used by the tools.
 *
 * Each function prefers Semantic Scholar and gracefully falls back to OpenAlex
 * (and vice-versa for server-side-sorted queries), normalizing everything into
 * NormalizedPaper / NormalizedAuthor. getPaper additionally fills a missing abstract
 * from Elsevier for ScienceDirect DOIs. Tools never call the API client directly.
 */

import {
  ApiError,
  elsevierGet,
  hasElsevierKey,
  openAlexGet,
  s2GraphGet,
  s2RecommendationsGet,
} from "./apiClient.js";
import {
  COCITATION_MAX_CITERS,
  COCITATION_PER_CITER,
  COUPLING_MAX_REFS,
  COUPLING_PER_REF,
  ELSEVIER_DOI_PREFIXES,
  FANOUT_CONCURRENCY,
  OPENALEX_AUTHOR_SELECT,
  OPENALEX_OR_BATCH,
  OPENALEX_WORK_SELECT,
  S2_AUTHOR_FIELDS,
  S2_PAPER_FULL_FIELDS,
  S2_PAPER_LIST_FIELDS,
} from "./constants.js";
import type {
  DataSource,
  ElsevierArticleResponse,
  NormalizedAuthor,
  NormalizedId,
  NormalizedPaper,
  OpenAlexAuthor,
  OpenAlexListResponse,
  OpenAlexWork,
  S2Author,
  S2AuthorPapersResponse,
  S2AuthorSearchResponse,
  S2CitationEdge,
  S2EdgeListResponse,
  S2Paper,
  S2PaperSearchResponse,
  S2RecommendationResponse,
  S2ReferenceEdge,
} from "./types.js";
import {
  bareOpenAlexId,
  dedupePapers,
  fromOpenAlexAuthor,
  fromOpenAlexWork,
  fromS2Author,
  fromS2Paper,
  mapWithConcurrency,
  normalizeId,
  paperKey,
} from "./utils.js";

export type PaperSort = "relevance" | "year" | "citationCount";

export interface PagedPapers {
  papers: NormalizedPaper[];
  total: number | null;
  hasMore: boolean;
  source: DataSource;
}

export interface PagedAuthors {
  authors: NormalizedAuthor[];
  total: number | null;
  hasMore: boolean;
  source: DataSource;
}

const S2_SHA_RE = /^[0-9a-f]{40}$/i;
const OPENALEX_AUTHOR_RE = /^A\d+$/i;

/** True when an identifier is concrete enough to resolve directly (vs. a keyword query). */
export function looksLikeId(normId: NormalizedId): boolean {
  if (normId.kind !== "s2") return true;
  return S2_SHA_RE.test(normId.raw);
}

function openAlexPage(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1;
}

function openAlexSort(sort: PaperSort): string | undefined {
  if (sort === "year") return "publication_year:desc";
  if (sort === "citationCount") return "cited_by_count:desc";
  return undefined;
}

/**
 * Run `primary`; if it throws a (retryable) ApiError, OR returns an empty first
 * page while `allowEmptyFallback` is set, defer to `fallback`. This is what makes
 * an elided/missing Semantic Scholar field (e.g. publisher-elided references that
 * come back as `data: null`) transparently resolve via OpenAlex.
 */
async function preferNonEmpty(
  primary: () => Promise<PagedPapers>,
  fallback: () => Promise<PagedPapers>,
  allowEmptyFallback: boolean,
): Promise<PagedPapers> {
  try {
    const result = await primary();
    if (result.papers.length > 0 || !allowEmptyFallback) return result;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  return fallback();
}

// ---------------------------------------------------------------------------
// Paper search
// ---------------------------------------------------------------------------

export interface SearchOpts {
  yearFrom?: number | null;
  yearTo?: number | null;
}

/** Format a year range for the Semantic Scholar `year` param ("2024", "2024-2026", "2024-"). */
function s2YearParam(opts: SearchOpts): string | undefined {
  const { yearFrom, yearTo } = opts;
  if (yearFrom == null && yearTo == null) return undefined;
  return `${yearFrom ?? ""}-${yearTo ?? ""}`.replace(/^-$/, "");
}

/** Format a year range for the OpenAlex `publication_year` filter ("2024-2026"). */
function openAlexYearFilter(opts: SearchOpts): string | undefined {
  const { yearFrom, yearTo } = opts;
  if (yearFrom == null && yearTo == null) return undefined;
  if (yearFrom != null && yearTo != null) return `${yearFrom}-${yearTo}`;
  if (yearFrom != null) return `>${yearFrom - 1}`;
  return `<${(yearTo as number) + 1}`;
}

export async function searchPapers(query: string, limit: number, offset: number, opts: SearchOpts = {}): Promise<PagedPapers> {
  const s2 = async (): Promise<PagedPapers> => {
    const data = await s2GraphGet<S2PaperSearchResponse>("/paper/search", {
      query,
      fields: S2_PAPER_LIST_FIELDS,
      limit,
      offset,
      year: s2YearParam(opts),
    });
    const papers = (data.data ?? []).map(fromS2Paper);
    return { papers, total: data.total ?? null, hasMore: data.next !== undefined, source: "semantic_scholar" };
  };
  return preferNonEmpty(s2, () => searchPapersOpenAlex(query, limit, offset, opts), offset === 0);
}

async function searchPapersOpenAlex(query: string, limit: number, offset: number, opts: SearchOpts = {}): Promise<PagedPapers> {
  const yearFilter = openAlexYearFilter(opts);
  const data = await openAlexGet<OpenAlexListResponse<OpenAlexWork>>("/works", {
    search: query,
    per_page: limit,
    page: openAlexPage(offset, limit),
    filter: yearFilter ? `publication_year:${yearFilter}` : undefined,
    select: OPENALEX_WORK_SELECT,
  });
  const papers = (data.results ?? []).map(fromOpenAlexWork);
  const total = data.meta?.count ?? null;
  return {
    papers,
    total,
    hasMore: total !== null ? offset + papers.length < total : papers.length === limit,
    source: "openalex",
  };
}

// ---------------------------------------------------------------------------
// Paper get
// ---------------------------------------------------------------------------

export async function getPaper(normId: NormalizedId): Promise<NormalizedPaper> {
  const isElsevierDoi = (doi: string | null): doi is string =>
    Boolean(doi && hasElsevierKey() && ELSEVIER_DOI_PREFIXES.some((prefix) => doi.startsWith(prefix)));
  // For an Elsevier DOI the abstract lookup does not depend on the metadata lookup, so start both together.
  const earlyAbstract = isElsevierDoi(normId.doi) ? getElsevierAbstract(normId.doi) : null;
  const paper = await resolvePaper(normId);
  if (paper.abstract || !isElsevierDoi(paper.doi)) return paper;
  const abstract = await (paper.doi === normId.doi && earlyAbstract ? earlyAbstract : getElsevierAbstract(paper.doi));
  return abstract ? { ...paper, abstract, abstractSource: "elsevier" } : paper;
}

/**
 * Semantic Scholar and OpenAlex elide abstracts for most Elsevier journals; ScienceDirect returns
 * them to any API key (no institutional entitlement needed for view=META_ABS). Never throws on API errors.
 */
async function getElsevierAbstract(doi: string): Promise<string | null> {
  try {
    const data = await elsevierGet<ElsevierArticleResponse>(`/content/article/doi/${doi}`, { view: "META_ABS" });
    const text = data["full-text-retrieval-response"]?.coredata?.["dc:description"];
    const abstract = typeof text === "string" ? text.replace(/\s+/g, " ").replace(/^Abstract\s+/i, "").trim() : "";
    return abstract || null;
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

async function resolvePaper(normId: NormalizedId): Promise<NormalizedPaper> {
  // When both sources can answer, ask both at once: S2 is preferred (richer record), and its frequent
  // 404/429 then costs no extra round trip because OpenAlex is already in flight.
  const openAlex = normId.openalex
    ? openAlexGet<OpenAlexWork>(`/works/${encodeURIComponent(normId.openalex)}`, { select: OPENALEX_WORK_SELECT }).then(fromOpenAlexWork)
    : null;
  openAlex?.catch(() => undefined); // S2 may win; an OpenAlex failure is only reported if it is the answer.
  if (normId.s2) {
    try {
      const data = await s2GraphGet<S2Paper>(`/paper/${encodeURIComponent(normId.s2)}`, { fields: S2_PAPER_FULL_FIELDS }, !openAlex);
      const paper = fromS2Paper(data);
      if (paper.abstract || !openAlex) return paper;
      const fallback = await openAlex.catch(() => null);
      return fallback?.abstract ? { ...paper, abstract: fallback.abstract, abstractSource: "openalex" } : paper;
    } catch (error) {
      if (!(error instanceof ApiError) || !openAlex) throw error;
    }
  }
  if (openAlex) return openAlex;
  throw new ApiError(`Could not resolve paper '${normId.raw}' on Semantic Scholar`, 404, "semantic_scholar");
}

// ---------------------------------------------------------------------------
// References (Earlier Work)
// ---------------------------------------------------------------------------

export async function getReferences(normId: NormalizedId, limit: number, offset: number): Promise<PagedPapers> {
  const s2 = async (): Promise<PagedPapers> => {
    if (!normId.s2) throw new ApiError(`No Semantic Scholar id for '${normId.raw}'`, 404, "semantic_scholar");
    const data = await s2GraphGet<S2EdgeListResponse<S2ReferenceEdge>>(
      `/paper/${encodeURIComponent(normId.s2)}/references`,
      { fields: S2_PAPER_LIST_FIELDS, limit, offset },
      !normId.openalex,
    );
    const papers = (data.data ?? [])
      .map((edge) => edge.citedPaper)
      .filter((p): p is S2Paper => Boolean(p))
      .map(fromS2Paper);
    return { papers, total: null, hasMore: data.next !== undefined, source: "semantic_scholar" };
  };
  // Fall back to OpenAlex on error OR when S2 returns nothing (e.g. publisher-elided references).
  return preferNonEmpty(s2, () => getReferencesOpenAlex(normId, limit, offset), offset === 0 && Boolean(normId.openalex));
}

async function getReferencesOpenAlex(normId: NormalizedId, limit: number, offset: number): Promise<PagedPapers> {
  if (!normId.openalex) {
    throw new ApiError(`No OpenAlex identifier available for '${normId.raw}'`, 404, "openalex");
  }
  const work = await openAlexGet<OpenAlexWork>(`/works/${encodeURIComponent(normId.openalex)}`, {
    select: "id,referenced_works,referenced_works_count",
  });
  const refs = work.referenced_works ?? [];
  const total = work.referenced_works_count ?? refs.length;
  const slice = refs.slice(offset, offset + limit).map(bareOpenAlexId);
  const papers = await hydrateOpenAlexWorks(slice);
  return { papers, total, hasMore: offset + slice.length < total, source: "openalex" };
}

// ---------------------------------------------------------------------------
// Citations (Later Work)
// ---------------------------------------------------------------------------

export async function getCitations(
  normId: NormalizedId,
  limit: number,
  offset: number,
  sort: PaperSort,
): Promise<PagedPapers> {
  // For explicit sorts, OpenAlex offers reliable server-side ordering; otherwise S2 leads.
  const openAlexFirst = sort !== "relevance";
  const primary = openAlexFirst ? () => getCitationsOpenAlex(normId, limit, offset, sort) : () => getCitationsS2(normId, limit, offset, sort);
  const fallback = openAlexFirst ? () => getCitationsS2(normId, limit, offset, sort) : () => getCitationsOpenAlex(normId, limit, offset, sort);
  return preferNonEmpty(primary, fallback, offset === 0);
}

async function getCitationsS2(normId: NormalizedId, limit: number, offset: number, sort: PaperSort): Promise<PagedPapers> {
  if (!normId.s2) throw new ApiError(`No Semantic Scholar id for '${normId.raw}'`, 404, "semantic_scholar");
  const data = await s2GraphGet<S2EdgeListResponse<S2CitationEdge>>(
    `/paper/${encodeURIComponent(normId.s2)}/citations`,
    { fields: S2_PAPER_LIST_FIELDS, limit, offset },
    !normId.openalex,
  );
  let papers = (data.data ?? [])
    .map((edge) => edge.citingPaper)
    .filter((p): p is S2Paper => Boolean(p))
    .map(fromS2Paper);
  papers = sortPapersClientSide(papers, sort);
  return { papers, total: null, hasMore: data.next !== undefined, source: "semantic_scholar" };
}

async function getCitationsOpenAlex(normId: NormalizedId, limit: number, offset: number, sort: PaperSort): Promise<PagedPapers> {
  const workId = await resolveOpenAlexWorkId(normId);
  const data = await openAlexGet<OpenAlexListResponse<OpenAlexWork>>("/works", {
    filter: `cites:${workId}`,
    per_page: limit,
    page: openAlexPage(offset, limit),
    sort: openAlexSort(sort),
    select: OPENALEX_WORK_SELECT,
  });
  const papers = (data.results ?? []).map(fromOpenAlexWork);
  const total = data.meta?.count ?? null;
  return {
    papers,
    total,
    hasMore: total !== null ? offset + papers.length < total : papers.length === limit,
    source: "openalex",
  };
}

function sortPapersClientSide(papers: NormalizedPaper[], sort: PaperSort): NormalizedPaper[] {
  if (sort === "year") return [...papers].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (sort === "citationCount") return [...papers].sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0));
  return papers;
}

// ---------------------------------------------------------------------------
// Similar Work (recommendations + related_works, merged)
// ---------------------------------------------------------------------------

export interface SimilarResult {
  papers: NormalizedPaper[];
  sources: DataSource[];
}

export async function getSimilar(normId: NormalizedId, limit: number): Promise<SimilarResult> {
  const collected: NormalizedPaper[] = [];
  const sources: DataSource[] = [];

  // Semantic Scholar recommendations.
  if (normId.s2) {
    try {
      const rec = await s2RecommendationsGet<S2RecommendationResponse>(
        `/papers/forpaper/${encodeURIComponent(normId.s2)}`,
        { fields: S2_PAPER_LIST_FIELDS, limit: Math.min(limit * 2, 100) },
      );
      const papers = (rec.recommendedPapers ?? []).map(fromS2Paper);
      if (papers.length) {
        collected.push(...papers);
        sources.push("semantic_scholar");
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  }

  // OpenAlex related_works.
  try {
    const relatedIds = await getRelatedWorkIds(normId);
    if (relatedIds.length) {
      const papers = await hydrateOpenAlexWorks(relatedIds.slice(0, Math.min(limit * 2, 50)));
      if (papers.length) {
        collected.push(...papers);
        sources.push("openalex");
      }
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  const deduped = dedupePapers(collected)
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0))
    .slice(0, limit);
  return { papers: deduped, sources };
}

async function getRelatedWorkIds(normId: NormalizedId): Promise<string[]> {
  if (!normId.openalex) return [];
  const work = await openAlexGet<OpenAlexWork>(`/works/${encodeURIComponent(normId.openalex)}`, {
    select: "id,related_works",
  });
  return (work.related_works ?? []).map(bareOpenAlexId);
}

// ---------------------------------------------------------------------------
// OpenAlex helpers
// ---------------------------------------------------------------------------

/** Resolve any normalized id to a bare OpenAlex work id ("W…"), fetching if needed. */
async function resolveOpenAlexWorkId(normId: NormalizedId): Promise<string> {
  if (normId.openalex && /^W\d+$/i.test(bareOpenAlexId(normId.openalex))) {
    return bareOpenAlexId(normId.openalex).toUpperCase();
  }
  if (!normId.openalex) {
    throw new ApiError(`No OpenAlex identifier available for '${normId.raw}'`, 404, "openalex");
  }
  const work = await openAlexGet<OpenAlexWork>(`/works/${encodeURIComponent(normId.openalex)}`, { select: "id" });
  if (!work.id) throw new ApiError(`OpenAlex could not resolve '${normId.raw}'`, 404, "openalex");
  return bareOpenAlexId(work.id).toUpperCase();
}

/** Batch-fetch OpenAlex works by id (≤50 per request, batches in parallel), preserving input order. */
export async function hydrateOpenAlexWorks(ids: string[]): Promise<NormalizedPaper[]> {
  if (ids.length === 0) return [];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += OPENALEX_OR_BATCH) batches.push(ids.slice(i, i + OPENALEX_OR_BATCH));
  const responses = await Promise.all(
    batches.map((batch) =>
      openAlexGet<OpenAlexListResponse<OpenAlexWork>>("/works", {
        filter: `ids.openalex:${batch.join("|")}`,
        per_page: batch.length,
        select: OPENALEX_WORK_SELECT,
      }),
    ),
  );
  const byId = new Map<string, NormalizedPaper>();
  for (const work of responses.flatMap((data) => data.results ?? [])) {
    const paper = fromOpenAlexWork(work);
    if (paper.openAlexId) byId.set(paper.openAlexId.toUpperCase(), paper);
  }
  return ids.map((id) => byId.get(id.toUpperCase())).filter((p): p is NormalizedPaper => Boolean(p));
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export async function searchAuthors(query: string, limit: number, offset: number): Promise<PagedAuthors> {
  try {
    const data = await s2GraphGet<S2AuthorSearchResponse>("/author/search", {
      query,
      fields: S2_AUTHOR_FIELDS,
      limit,
      offset,
    });
    const authors = (data.data ?? []).map(fromS2Author);
    return { authors, total: data.total ?? null, hasMore: data.next !== undefined, source: "semantic_scholar" };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const data = await openAlexGet<OpenAlexListResponse<OpenAlexAuthor>>("/authors", {
      search: query,
      per_page: limit,
      page: openAlexPage(offset, limit),
      select: OPENALEX_AUTHOR_SELECT,
    });
    const authors = (data.results ?? []).map(fromOpenAlexAuthor);
    const total = data.meta?.count ?? null;
    return {
      authors,
      total,
      hasMore: total !== null ? offset + authors.length < total : authors.length === limit,
      source: "openalex",
    };
  }
}

export async function getAuthor(authorId: string): Promise<NormalizedAuthor> {
  const isOpenAlex = OPENALEX_AUTHOR_RE.test(bareOpenAlexId(authorId));
  if (isOpenAlex) {
    const data = await openAlexGet<OpenAlexAuthor>(`/authors/${encodeURIComponent(bareOpenAlexId(authorId))}`, {
      select: OPENALEX_AUTHOR_SELECT,
    });
    return fromOpenAlexAuthor(data);
  }
  try {
    // An S2 author id has no OpenAlex equivalent, so the fallback below rarely helps: retry S2 rate limits.
    const data = await s2GraphGet<S2Author>(`/author/${encodeURIComponent(authorId)}`, { fields: S2_AUTHOR_FIELDS }, true);
    return fromS2Author(data);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const data = await openAlexGet<OpenAlexAuthor>(`/authors/${encodeURIComponent(bareOpenAlexId(authorId))}`, {
      select: OPENALEX_AUTHOR_SELECT,
    });
    return fromOpenAlexAuthor(data);
  }
}

export async function getAuthorPapers(
  authorId: string,
  limit: number,
  offset: number,
  sort: PaperSort,
): Promise<PagedPapers> {
  const isOpenAlex = OPENALEX_AUTHOR_RE.test(bareOpenAlexId(authorId));
  if (isOpenAlex) {
    return getAuthorPapersOpenAlex(bareOpenAlexId(authorId), limit, offset, sort);
  }
  try {
    const data = await s2GraphGet<S2AuthorPapersResponse>(
      `/author/${encodeURIComponent(authorId)}/papers`,
      { fields: S2_PAPER_LIST_FIELDS, limit, offset },
      true,
    );
    const papers = sortPapersClientSide((data.data ?? []).map(fromS2Paper), sort);
    return { papers, total: null, hasMore: data.next !== undefined, source: "semantic_scholar" };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return getAuthorPapersOpenAlex(bareOpenAlexId(authorId), limit, offset, sort);
  }
}

async function getAuthorPapersOpenAlex(
  authorId: string,
  limit: number,
  offset: number,
  sort: PaperSort,
): Promise<PagedPapers> {
  const data = await openAlexGet<OpenAlexListResponse<OpenAlexWork>>("/works", {
    filter: `author.id:${authorId}`,
    per_page: limit,
    page: openAlexPage(offset, limit),
    sort: openAlexSort(sort === "relevance" ? "citationCount" : sort),
    select: OPENALEX_WORK_SELECT,
  });
  const papers = (data.results ?? []).map(fromOpenAlexWork);
  const total = data.meta?.count ?? null;
  return {
    papers,
    total,
    hasMore: total !== null ? offset + papers.length < total : papers.length === limit,
    source: "openalex",
  };
}

// ---------------------------------------------------------------------------
// Bibliometric neighbors: bibliographic coupling & co-citation
// ---------------------------------------------------------------------------

export interface ScoredPaper {
  paper: NormalizedPaper;
  score: number; // shared references (coupling) or co-citation count
}

/** Identifier keys a seed can match under, to exclude it from its own neighbor lists. */
function seedExcludeKeys(normId: NormalizedId): Set<string> {
  const keys = new Set<string>();
  if (normId.doi) keys.add(`doi:${normId.doi}`);
  if (normId.openalex && /^W\d+$/i.test(bareOpenAlexId(normId.openalex))) keys.add(`oa:${bareOpenAlexId(normId.openalex).toUpperCase()}`);
  if (normId.kind === "s2") keys.add(`s2:${normId.raw}`);
  return keys;
}

// Fan-out id: an OpenAlex work id lets the OpenAlex path query `cites:W…` directly instead of
// first resolving a DOI to a work id (one request per neighbor instead of two).
const idOf = (p: NormalizedPaper): string | null => p.openAlexId ?? p.doi ?? p.paperId;

export interface BiblioOpts {
  maxRefs?: number;
  perRef?: number;
  maxCiters?: number;
  perCiter?: number;
  limit?: number;
}

/**
 * Bibliographic coupling: papers that SHARE references with the seed. Strength =
 * how many of the seed's references a candidate also cites. Surfaces topical
 * siblings even when they don't cite the seed or each other. Implemented by
 * expanding the citers of each of the seed's references and tallying overlap.
 */
export async function bibliographicCoupling(normId: NormalizedId, opts: BiblioOpts = {}): Promise<ScoredPaper[]> {
  const maxRefs = opts.maxRefs ?? COUPLING_MAX_REFS;
  const perRef = opts.perRef ?? COUPLING_PER_REF;
  const limit = opts.limit ?? 20;
  const exclude = seedExcludeKeys(normId);

  const refs = (await getReferences(normId, maxRefs, 0).catch(() => ({ papers: [] as NormalizedPaper[] }))).papers;
  const refKeys = new Set(refs.map(paperKey));
  const tally = new Map<string, { paper: NormalizedPaper; shared: Set<string> }>();

  await mapWithConcurrency(refs, FANOUT_CONCURRENCY, async (ref) => {
    const refId = idOf(ref);
    if (!refId) return;
    const citers = await getCitations(normalizeId(refId), perRef, 0, "relevance").catch(() => ({ papers: [] as NormalizedPaper[] }));
    for (const citer of citers.papers) {
      const key = paperKey(citer);
      if (exclude.has(key) || refKeys.has(key)) continue;
      const entry = tally.get(key);
      if (entry) {
        entry.shared.add(paperKey(ref));
        if (citer.abstract && !entry.paper.abstract) entry.paper = citer;
      } else {
        tally.set(key, { paper: citer, shared: new Set([paperKey(ref)]) });
      }
    }
  });

  return [...tally.values()]
    .map((e) => ({ paper: e.paper, score: e.shared.size }))
    .sort((a, b) => b.score - a.score || (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0))
    .slice(0, limit);
}

/**
 * Co-citation: papers frequently cited ALONGSIDE the seed. Strength = how many of
 * the seed's citing papers also cite the candidate. Surfaces the foundational works
 * the field reads together with the seed. Implemented by expanding the references of
 * each paper that cites the seed and tallying overlap.
 */
export async function coCitation(normId: NormalizedId, opts: BiblioOpts = {}): Promise<ScoredPaper[]> {
  const maxCiters = opts.maxCiters ?? COCITATION_MAX_CITERS;
  const perCiter = opts.perCiter ?? COCITATION_PER_CITER;
  const limit = opts.limit ?? 20;
  const exclude = seedExcludeKeys(normId);

  const citers = (await getCitations(normId, maxCiters, 0, "citationCount").catch(() => ({ papers: [] as NormalizedPaper[] }))).papers;
  const citerWorkIds = citers.map((c) => c.openAlexId);
  if (citerWorkIds.length > 0 && citerWorkIds.every((id): id is string => Boolean(id))) {
    return coCitationOpenAlex(normId, citerWorkIds, perCiter, limit, exclude);
  }
  const tally = new Map<string, { paper: NormalizedPaper; count: number }>();

  await mapWithConcurrency(citers, FANOUT_CONCURRENCY, async (citer) => {
    const citerId = idOf(citer);
    if (!citerId) return;
    const refs = await getReferences(normalizeId(citerId), perCiter, 0).catch(() => ({ papers: [] as NormalizedPaper[] }));
    for (const ref of refs.papers) {
      const key = paperKey(ref);
      if (exclude.has(key)) continue;
      const entry = tally.get(key);
      if (entry) {
        entry.count += 1;
        if (ref.abstract && !entry.paper.abstract) entry.paper = ref;
      } else {
        tally.set(key, { paper: ref, count: 1 });
      }
    }
  });

  return [...tally.values()]
    .map((e) => ({ paper: e.paper, score: e.count }))
    .sort((a, b) => b.score - a.score || (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0))
    .slice(0, limit);
}

/**
 * Same tally when every citer has an OpenAlex id: fetch all citers' reference-id lists in batched
 * requests (50 citers per request), count ids, and hydrate only the leading candidates. About
 * 4 requests instead of 2 per citer. Candidates past `limit` are hydrated (3× limit) so the
 * citation-count tie-break among equal scores still sees most contenders.
 */
async function coCitationOpenAlex(
  normId: NormalizedId,
  citerWorkIds: string[],
  perCiter: number,
  limit: number,
  exclude: Set<string>,
): Promise<ScoredPaper[]> {
  const seedWorkId = await resolveOpenAlexWorkId(normId).catch(() => null);
  const batches: string[][] = [];
  for (let i = 0; i < citerWorkIds.length; i += OPENALEX_OR_BATCH) batches.push(citerWorkIds.slice(i, i + OPENALEX_OR_BATCH));
  const responses = await Promise.all(
    batches.map((batch) =>
      openAlexGet<OpenAlexListResponse<OpenAlexWork>>("/works", {
        filter: `ids.openalex:${batch.join("|")}`,
        per_page: batch.length,
        select: "id,referenced_works",
      }).catch(() => ({ results: [] as OpenAlexWork[] })),
    ),
  );
  const counts = new Map<string, number>();
  for (const work of responses.flatMap((data) => data.results ?? [])) {
    for (const ref of (work.referenced_works ?? []).slice(0, perCiter)) {
      const id = bareOpenAlexId(ref).toUpperCase();
      if (id === seedWorkId || exclude.has(`oa:${id}`)) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const leading = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 3);
  const papers = await hydrateOpenAlexWorks(leading.map(([id]) => id));
  return papers
    .filter((paper) => !exclude.has(paperKey(paper)))
    .map((paper) => ({ paper, score: counts.get((paper.openAlexId ?? "").toUpperCase()) ?? 0 }))
    .sort((a, b) => b.score - a.score || (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0))
    .slice(0, limit);
}

// Re-export for tools.
export { normalizeId };
