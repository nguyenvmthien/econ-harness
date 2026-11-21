import { readFileSync } from "node:fs";

type RankSource = "SJR" | "ABDC";
type RankBucket = "Q1" | "Q2" | "A*" | "A" | "B";

interface JournalRank {
  source: RankSource;
  year: number;
  title: string;
  issns: string[];
  rank: RankBucket;
  sjr?: string;
  subjectCategories?: { name: string; quartile: string }[];
  fieldOfResearch?: string;
}

interface RankDatabase {
  schemaVersion: number;
  generatedAt: string;
  sources: Record<RankSource, { year: number; title: string; sourceUrl: string; attribution: string }>;
  journals: JournalRank[];
}

function normalizeJournalKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeIssn(value: string): string {
  return value.replace(/[^0-9x]/gi, "").toUpperCase();
}

const databasePath = new URL("../data/journal-ranks.json", import.meta.url);
let database: RankDatabase | null = null;
try {
  const loaded = JSON.parse(readFileSync(databasePath, "utf8")) as RankDatabase;
  if (loaded.schemaVersion === 1 && Array.isArray(loaded.journals)) database = loaded;
} catch {
  // The MCP's other research tools remain usable until local rank data is imported.
}

const byTitle = new Map<string, JournalRank[]>();
const byIssn = new Map<string, JournalRank[]>();
if (database) {
  for (const journal of database.journals) {
    const key = normalizeJournalKey(journal.title);
    const titleRows = byTitle.get(key);
    if (titleRows) titleRows.push(journal);
    else byTitle.set(key, [journal]);
    for (const issn of journal.issns) {
      const issnKey = normalizeIssn(issn);
      const issnRows = byIssn.get(issnKey);
      if (issnRows) issnRows.push(journal);
      else byIssn.set(issnKey, [journal]);
    }
  }
}

const titleEntries = [...byTitle.entries()];
const rankOrder: Record<RankBucket, number> = { "A*": 0, Q1: 0, A: 1, Q2: 1, B: 2 };

function requireRankDatabase(): RankDatabase {
  if (!database) {
    throw new Error(`Local journal-rank index missing or invalid at ${databasePath.pathname}; import the SJR and ABDC files with npm run ranks:import.`);
  }
  return database;
}

export interface RankFilter {
  source: RankSource;
  ranks?: RankBucket[];
  subjectCategory?: string;
  fieldOfResearch?: string;
}

export interface JournalRankResult {
  source: RankSource;
  year: number;
  title: string;
  issns: string[];
  rank: RankBucket;
  sjr?: string;
  subjectCategories?: { name: string; quartile: string }[];
  fieldOfResearch?: string;
}

function asResult(row: JournalRank): JournalRankResult {
  return {
    source: row.source,
    year: row.year,
    title: row.title,
    issns: row.issns,
    rank: row.rank,
    ...(row.sjr ? { sjr: row.sjr } : {}),
    ...(row.subjectCategories ? { subjectCategories: row.subjectCategories } : {}),
    ...(row.fieldOfResearch ? { fieldOfResearch: row.fieldOfResearch } : {}),
  };
}

function matchesFilter(row: JournalRank, filter: RankFilter): boolean {
  if (row.source !== filter.source) return false;
  if (filter.fieldOfResearch && (row.source !== "ABDC" || row.fieldOfResearch !== filter.fieldOfResearch)) return false;
  if (filter.subjectCategory) {
    if (row.source !== "SJR") return false;
    const category = normalizeJournalKey(filter.subjectCategory);
    return Boolean(row.subjectCategories?.some(
      (entry) =>
        normalizeJournalKey(entry.name).includes(category) &&
        (!filter.ranks?.length || filter.ranks.includes(entry.quartile as RankBucket)),
    ));
  }
  return !filter.ranks?.length || filter.ranks.includes(row.rank);
}

export function rankSources(): RankDatabase["sources"] {
  return requireRankDatabase().sources;
}

export function ranksForVenue(venue: string | null, filter: RankFilter): JournalRankResult[] {
  requireRankDatabase();
  if (!venue) return [];
  const records = byTitle.get(normalizeJournalKey(venue)) ?? [];
  return records.filter((row) => matchesFilter(row, filter)).flatMap((row) => {
    if (!filter.subjectCategory) return [asResult(row)];
    const category = normalizeJournalKey(filter.subjectCategory);
    return (row.subjectCategories ?? [])
      .filter((entry) =>
        normalizeJournalKey(entry.name).includes(category) &&
        (!filter.ranks?.length || filter.ranks.includes(entry.quartile as RankBucket)),
      )
      .map((entry) => ({ ...asResult(row), rank: entry.quartile as RankBucket, subjectCategories: [entry] }));
  });
}

export function bestVenueRank(venue: string | null, filter: RankFilter): JournalRankResult | null {
  const ranks = ranksForVenue(venue, filter);
  ranks.sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank] || a.title.localeCompare(b.title));
  return ranks[0] ?? null;
}

export function searchJournalRanks(query: string, source?: RankSource, limit = 20, fieldOfResearch?: string): JournalRankResult[] {
  requireRankDatabase();
  const normalizedQuery = normalizeJournalKey(query);
  const issn = normalizeIssn(query);
  const issnMatches = issn.length >= 8 ? byIssn.get(issn) ?? [] : [];
  const candidates = issnMatches.length
    ? issnMatches
    : normalizedQuery.length >= 3
      ? titleEntries.filter(([key]) => key.includes(normalizedQuery)).flatMap(([, rows]) => rows)
      : [];
  const unique = new Map<string, JournalRankResult>();
  for (const row of candidates) {
    if (source && row.source !== source) continue;
    if (fieldOfResearch && (row.source !== "ABDC" || row.fieldOfResearch !== fieldOfResearch)) continue;
    const result = asResult(row);
    unique.set(`${row.source}:${row.title}:${row.rank}:${row.fieldOfResearch ?? ""}`, result);
  }
  return [...unique.values()].slice(0, limit);
}

export function rankSortValue(rank: RankBucket): number {
  return rankOrder[rank];
}

export type { RankBucket, RankSource };
