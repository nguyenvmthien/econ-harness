/**
 * Shared HTTP client for Semantic Scholar, OpenAlex, and Elsevier.
 *
 * Centralizes: auth headers, the OpenAlex "polite pool" email, request timeouts,
 * retry on 5xx / transient network errors, an in-process and an on-disk response
 * cache, a global OpenAlex in-flight cap, and a Semantic Scholar circuit breaker.
 *
 * Semantic Scholar 429s: without a key nearly every request is refused, so a 429 is
 * not retried and S2 is skipped for S2_COOLDOWN_MS. With a key about half are still
 * refused at random. A caller that has an OpenAlex fallback gets the 429 at once (and
 * S2 is skipped for S2_KEYED_COOLDOWN_MS), because falling through is faster than
 * retrying; a caller with no fallback passes `retryRateLimit` and retries instead.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  DISK_CACHE_DEFAULT_DIR,
  DISK_CACHE_NOT_FOUND_TTL_MS,
  DISK_CACHE_TTL_MS,
  ELSEVIER_BASE,
  MAX_RETRIES,
  OPENALEX_BASE,
  OPENALEX_MAX_IN_FLIGHT,
  REQUEST_TIMEOUT_MS,
  S2_COOLDOWN_MS,
  S2_KEYED_429_DELAY_MS,
  S2_KEYED_429_RETRIES,
  S2_KEYED_COOLDOWN_MS,
  S2_GRAPH_BASE,
  S2_REC_BASE,
} from "./constants.js";

type Source = "semantic_scholar" | "openalex" | "elsevier";

/** Error carrying the upstream HTTP status (or 0 for network/timeout failures). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly source: Source,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type QueryValue = string | number | boolean | undefined | null;
export type QueryParams = Record<string, QueryValue>;

function buildUrl(base: string, path: string, params: QueryParams): string {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff with full jitter, honoring a Retry-After header when present. */
function backoffDelayMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 30_000);
    }
  }
  const base = Math.min(1000 * 2 ** attempt, 16_000);
  return Math.floor(base / 2 + Math.random() * (base / 2));
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// Semantic Scholar circuit breaker: epoch ms until which S2 requests are skipped.
let s2BlockedUntil = 0;

// Successful responses (and in-flight requests, so concurrent fan-outs share one fetch).
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

interface RawGetOptions {
  source: Source;
  headers?: Record<string, string>;
  /** S2 only: retry a keyed 429 instead of failing fast, for callers with no OpenAlex fallback. */
  retryRateLimit?: boolean;
}

// --- OpenAlex in-flight cap (fan-outs nest, so a per-helper limit alone can exceed the upstream rate) ---
let openAlexInFlight = 0;
const openAlexWaiters: (() => void)[] = [];

async function withOpenAlexSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (openAlexInFlight < OPENALEX_MAX_IN_FLIGHT) openAlexInFlight++;
  else await new Promise<void>((resolve) => openAlexWaiters.push(resolve)); // slot handed over by the releaser
  try {
    return await fn();
  } finally {
    const next = openAlexWaiters.shift();
    if (next) next();
    else openAlexInFlight--;
  }
}

/**
 * Low-level GET returning parsed JSON, with timeout + retry/backoff.
 * Throws ApiError on a non-OK status that survives retries, or on network failure.
 */
async function fetchJson<T>(url: string, opts: RawGetOptions): Promise<T> {
  const isS2 = opts.source === "semantic_scholar";
  const keyedS2 = isS2 && hasSemanticScholarKey();
  const retry429 = keyedS2 && opts.retryRateLimit === true;
  const maxRetries = retry429 ? S2_KEYED_429_RETRIES : MAX_RETRIES;
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (isS2 && !retry429 && Date.now() < s2BlockedUntil) {
      throw new ApiError("Semantic Scholar rate limit cool-down; using OpenAlex", 429, opts.source);
    }
    try {
      // The timeout starts once an OpenAlex slot is held, so queueing behind a fan-out never aborts a request.
      const request = async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            headers: { Accept: "application/json", ...opts.headers },
          });
          return { response, body: await response.text() };
        } finally {
          clearTimeout(timeout);
        }
      };
      const { response, body } = opts.source === "openalex" ? await withOpenAlexSlot(request) : await request();

      if (response.ok) {
        return JSON.parse(body) as T;
      }

      const message = `HTTP ${response.status} from ${opts.source}${body ? `: ${body.slice(0, 200)}` : ""}`;
      lastError = new ApiError(message, response.status, opts.source);
      const retryAfter = response.headers.get("retry-after");

      if (isS2 && response.status === 429) {
        if (retry429 && attempt < maxRetries) {
          await sleep(S2_KEYED_429_DELAY_MS);
          continue;
        }
        const cooldown = keyedS2 ? S2_KEYED_COOLDOWN_MS : Math.max(S2_COOLDOWN_MS, backoffDelayMs(0, retryAfter));
        s2BlockedUntil = Math.max(s2BlockedUntil, Date.now() + cooldown);
        throw lastError;
      }
      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        await sleep(backoffDelayMs(attempt, retryAfter));
        continue;
      }
      throw lastError;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const isAbort = error instanceof Error && error.name === "AbortError";
      lastError = new ApiError(
        isAbort ? `Request to ${opts.source} timed out` : `Network error reaching ${opts.source}: ${String(error)}`,
        0,
        opts.source,
      );
      if (attempt < MAX_RETRIES) {
        await sleep(backoffDelayMs(attempt, null));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new ApiError(`Unknown error from ${opts.source}`, 0, opts.source);
}

// --- On-disk cache: one JSON file per URL, shared by every server process. Keys are never in URLs. ---
// A 404 is stored too (S2 has no record for many Elsevier DOIs), so it is not re-asked on every lookup.
const diskCacheSetting = process.env.RESEARCH_DISCOVERY_CACHE_DIR?.trim();
const diskCacheDir = diskCacheSetting === "off" ? null : diskCacheSetting || join(homedir(), DISK_CACHE_DEFAULT_DIR);

type DiskEntry<T> = { url: string; savedAt: number; body: T } | { url: string; savedAt: number; notFound: ApiError["source"] };

function diskCachePath(url: string): string {
  return join(diskCacheDir as string, `${createHash("sha256").update(url).digest("hex").slice(0, 40)}.json`);
}

async function readDiskCache<T>(url: string): Promise<DiskEntry<T> | undefined> {
  if (!diskCacheDir) return undefined;
  try {
    const entry = JSON.parse(await readFile(diskCachePath(url), "utf8")) as DiskEntry<T>;
    const ttl = "notFound" in entry ? DISK_CACHE_NOT_FOUND_TTL_MS : DISK_CACHE_TTL_MS;
    return entry.url === url && Date.now() - entry.savedAt < ttl ? entry : undefined;
  } catch {
    return undefined;
  }
}

async function writeDiskCache<T>(entry: DiskEntry<T>): Promise<void> {
  if (!diskCacheDir) return;
  const file = diskCachePath(entry.url);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await mkdir(diskCacheDir, { recursive: true });
    await writeFile(tmp, JSON.stringify(entry));
    await rename(tmp, file);
  } catch {
    await unlink(tmp).catch(() => undefined);
  }
}

/** Delete expired disk-cache files; run once at startup, off the request path. */
export async function pruneDiskCache(): Promise<void> {
  if (!diskCacheDir) return;
  const names = await readdir(diskCacheDir).catch(() => [] as string[]);
  const cutoff = Date.now() - DISK_CACHE_TTL_MS;
  for (const name of names) {
    const file = join(diskCacheDir, name);
    const info = await stat(file).catch(() => null);
    if (info && info.mtimeMs < cutoff) await unlink(file).catch(() => undefined);
  }
}

/** Cached GET: memory first, then disk, then network. Only successes and 404s are cached. */
function getJson<T>(url: string, opts: RawGetOptions): Promise<T> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  if (cache.size >= CACHE_MAX_ENTRIES) {
    for (const [key, entry] of cache) if (entry.expires <= now) cache.delete(key);
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  }
  const value = readDiskCache<T>(url).then(async (stored) => {
    if (stored && "notFound" in stored) throw new ApiError(`HTTP 404 from ${stored.notFound} (cached)`, 404, stored.notFound);
    if (stored) return stored.body;
    try {
      const body = await fetchJson<T>(url, opts);
      void writeDiskCache({ url, savedAt: Date.now(), body });
      return body;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) void writeDiskCache<T>({ url, savedAt: Date.now(), notFound: error.source });
      throw error;
    }
  });
  cache.set(url, { expires: now + CACHE_TTL_MS, value });
  value.catch(() => {
    if (cache.get(url)?.value === value) cache.delete(url);
  });
  return value;
}

// ---------------------------------------------------------------------------
// Public, source-specific helpers.
// ---------------------------------------------------------------------------

function semanticScholarHeaders(): Record<string, string> {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY;
  return key ? { "x-api-key": key } : {};
}

function openAlexMailto(): string | undefined {
  return process.env.OPENALEX_EMAIL?.trim() || undefined;
}

/** GET against the Semantic Scholar Graph API (`/graph/v1`). Pass `retryRateLimit` when OpenAlex cannot answer the same call. */
export async function s2GraphGet<T>(path: string, params: QueryParams = {}, retryRateLimit = false): Promise<T> {
  return getJson<T>(buildUrl(S2_GRAPH_BASE, path, params), {
    source: "semantic_scholar",
    headers: semanticScholarHeaders(),
    retryRateLimit,
  });
}

/** GET against the Semantic Scholar Recommendations API (`/recommendations/v1`). */
export async function s2RecommendationsGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  return getJson<T>(buildUrl(S2_REC_BASE, path, params), {
    source: "semantic_scholar",
    headers: semanticScholarHeaders(),
  });
}

/** GET against the OpenAlex API, always joining the polite pool via `mailto`. */
export async function openAlexGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  return getJson<T>(buildUrl(OPENALEX_BASE, path, { ...params, mailto: openAlexMailto() }), {
    source: "openalex",
  });
}

/** GET against the Elsevier APIs (ScienceDirect / Scopus), authenticated by ELSEVIER_API_KEY. */
export async function elsevierGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  return getJson<T>(buildUrl(ELSEVIER_BASE, path, params), {
    source: "elsevier",
    headers: { "X-ELS-APIKey": process.env.ELSEVIER_API_KEY ?? "" },
  });
}

/** Whether an Elsevier API key is configured (enables ScienceDirect abstracts in paper_get). */
export function hasElsevierKey(): boolean {
  return Boolean(process.env.ELSEVIER_API_KEY?.trim());
}

/** Whether an OpenAlex polite-pool email is configured (used for a startup warning). */
export function hasOpenAlexEmail(): boolean {
  return Boolean(openAlexMailto());
}

/** Whether a Semantic Scholar API key is configured. */
export function hasSemanticScholarKey(): boolean {
  return Boolean(process.env.SEMANTIC_SCHOLAR_API_KEY);
}
