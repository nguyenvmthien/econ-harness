/**
 * Reusable Zod schemas: shared tool input fragments, and the item shapes used to
 * type the JSON payload of response_format="json".
 */

import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./constants.js";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

// --- Reusable input fragments (raw-shape friendly) ---

export const paperIdInput = z
  .string()
  .min(3, "paper_id must be a non-trivial identifier")
  .describe(
    "Flexible paper identifier. Accepts a DOI ('10.1126/science.1244693' or 'https://doi.org/...'), " +
      "a Semantic Scholar paper id (40-char hash), an arXiv id ('arXiv:2017.12345'), an OpenAlex work id ('W1981213426'), " +
      "or 'CorpusId:NNN' / 'PMID:NNN'. DOI is preferred as the most portable key.",
  );

export const limitInput = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)
  .describe(`Maximum number of results to return (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}).`);

export const offsetInput = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Number of results to skip, for pagination (default 0).");

export const responseFormatInput = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' (human-readable, default) or 'json' (full structured data).");

export const yearFromInput = z
  .number()
  .int()
  .min(1800)
  .max(2100)
  .optional()
  .describe("Only include papers published in or after this year (e.g. 2024 for a recency sweep).");

export const yearToInput = z
  .number()
  .int()
  .min(1800)
  .max(2100)
  .optional()
  .describe("Only include papers published in or before this year.");

// --- Output shapes ---

export const AuthorRefSchema = z.object({
  authorId: z.string().nullable().describe("Semantic Scholar author id, if known."),
  openAlexId: z.string().nullable().describe("OpenAlex author id (e.g. 'A5023888391'), if known."),
  name: z.string(),
});

export const PaperListItemSchema = z.object({
  paperId: z.string().nullable().describe("Semantic Scholar paper id (hash)."),
  openAlexId: z.string().nullable(),
  doi: z.string().nullable(),
  arxivId: z.string().nullable(),
  title: z.string(),
  year: z.number().nullable(),
  authors: z.array(AuthorRefSchema),
  venue: z.string().nullable(),
  citationCount: z.number().nullable(),
  fieldsOfStudy: z.array(z.string()),
  openAccessPdf: z.string().nullable().describe("Direct open-access PDF URL, if one is known."),
  url: z.string().nullable(),
  abstractSnippet: z.string().nullable().describe("Truncated abstract (~320 chars), if available."),
  source: z.enum(["semantic_scholar", "openalex"]),
});
export type PaperListItem = z.infer<typeof PaperListItemSchema>;

export const PaperDetailSchema = PaperListItemSchema.extend({
  abstract: z.string().nullable().describe("Full abstract, if available."),
  abstractSource: z.enum(["semantic_scholar", "openalex", "elsevier"]).nullable().describe("API that supplied the abstract."),
  referenceCount: z.number().nullable(),
  influentialCitationCount: z.number().nullable(),
}).omit({ abstractSnippet: true });
export type PaperDetail = z.infer<typeof PaperDetailSchema>;

export const AuthorSchema = z.object({
  authorId: z.string().nullable(),
  openAlexId: z.string().nullable(),
  name: z.string(),
  affiliations: z.array(z.string()),
  homepage: z.string().nullable(),
  paperCount: z.number().nullable(),
  citationCount: z.number().nullable(),
  hIndex: z.number().nullable(),
  source: z.enum(["semantic_scholar", "openalex"]),
});
export type AuthorOut = z.infer<typeof AuthorSchema>;
