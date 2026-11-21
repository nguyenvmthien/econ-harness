/**
 * network_expand — the signature ResearchRabbit move.
 *
 * Given a collection of seed papers, pull each seed's references + citations +
 * similar work, aggregate across ALL seeds, and rank candidates by how many
 * seeds connect to them (frequency = relevance). Fan-out per seed is capped to
 * stay within upstream rate limits.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  EXPAND_PER_SEED_DEFAULT,
  EXPAND_PER_SEED_MAX,
  NETWORK_BIBLIO_CITERS,
  NETWORK_BIBLIO_PERCITER,
  NETWORK_BIBLIO_PERREF,
  NETWORK_BIBLIO_REFS,
} from "../constants.js";
import { bibliographicCoupling, coCitation, getCitations, getPaper, getReferences, getSimilar, normalizeId } from "../discovery.js";
import { buildResult, errorResult, toListItem } from "../format.js";
import { ResponseFormat, limitInput, responseFormatInput } from "../schemas.js";
import type { NormalizedPaper } from "../types.js";
import { paperKey } from "../utils.js";

type Relation = "reference" | "citation" | "similar" | "coupling" | "cocitation";
const ALL_RELATIONS = ["references", "citations", "similar", "coupling", "cocitation"] as const;

interface Candidate {
  paper: NormalizedPaper;
  connectedTo: Set<string>;
  via: Set<Relation>;
}

/** All identifier-key forms a resolved seed can appear under, for exclusion. */
function seedKeys(paper: NormalizedPaper): string[] {
  const keys: string[] = [];
  if (paper.doi) keys.push(`doi:${paper.doi}`);
  if (paper.openAlexId) keys.push(`oa:${paper.openAlexId}`);
  if (paper.paperId) keys.push(`s2:${paper.paperId}`);
  return keys;
}

export function registerNetworkTools(server: McpServer): void {
  server.registerTool(
    "network_expand",
    {
      title: "Expand a seed collection (signature discovery)",
      description: `Take a COLLECTION of seed papers and discover the papers most connected to the collection as a whole — the core ResearchRabbit workflow.

For each seed it pulls references (Earlier Work) + citations (Later Work) + similar work, then aggregates ACROSS all seeds and ranks each candidate by how many seeds connect to it (a paper linked from 3 of your 5 seeds ranks above one linked from 1). Seed papers themselves are excluded from the results.

Examples:
  - paper_ids=["10.1126/science.1244693","10.1038/nature14539"] -> ranked papers bridging both seeds.
  - "Which paper is most central to these 4 DOIs?" -> read the top result and its connection_count.`,
      inputSchema: {
        paper_ids: z.array(z.string().min(3)).min(1).max(20).describe("1-20 seed paper identifiers (DOIs preferred)."),
        include: z
          .array(z.enum(ALL_RELATIONS))
          .min(1)
          .default(["references", "citations", "similar"])
          .describe("Which neighbor relations to traverse (default: references+citations+similar). Add 'coupling'/'cocitation' for a deeper but heavier cluster."),
        per_seed: z.number().int().min(1).max(EXPAND_PER_SEED_MAX).default(EXPAND_PER_SEED_DEFAULT).describe(`Max candidates per seed per relation (default ${EXPAND_PER_SEED_DEFAULT}).`),
        limit: limitInput.describe("Max ranked candidates to return (1-100, default 25).").default(25),
        response_format: responseFormatInput,
      },
      annotations: { title: "Expand network", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ paper_ids, include, per_seed, limit, response_format }) => {
      try {
        // 1) Resolve seeds (parallel) to capture titles and exclusion keys.
        const resolved = await Promise.all(
          paper_ids.map(async (id) => {
            try {
              return { id, paper: await getPaper(normalizeId(id)) };
            } catch {
              return { id, paper: null as NormalizedPaper | null };
            }
          }),
        );
        const excludeKeys = new Set<string>();
        for (const r of resolved) if (r.paper) for (const k of seedKeys(r.paper)) excludeKeys.add(k);

        const liveSeeds = resolved.filter((r) => r.paper);
        if (liveSeeds.length === 0) {
          return errorResult(
            `None of the ${paper_ids.length} seed id(s) could be resolved. Verify them with paper_get or paper_search (DOIs work best).`,
          );
        }

        // 2) For each seed, traverse the requested relations (parallel, fault-tolerant).
        const candidates = new Map<string, Candidate>();
        const addCandidate = (seedId: string, relation: Relation, paper: NormalizedPaper) => {
          const key = paperKey(paper);
          if (excludeKeys.has(key)) return;
          const existing = candidates.get(key);
          if (existing) {
            existing.connectedTo.add(seedId);
            existing.via.add(relation);
            // Prefer the record with more authors/abstract for display.
            if ((paper.abstract && !existing.paper.abstract) || paper.authors.length > existing.paper.authors.length) {
              existing.paper = paper;
            }
          } else {
            candidates.set(key, { paper, connectedTo: new Set([seedId]), via: new Set([relation]) });
          }
        };

        const wantRefs = include.includes("references");
        const wantCits = include.includes("citations");
        const wantSim = include.includes("similar");
        const wantCoupling = include.includes("coupling");
        const wantCocitation = include.includes("cocitation");

        await Promise.all(
          liveSeeds.map(async ({ id }) => {
            const normId = normalizeId(id);
            const tasks: Promise<void>[] = [];
            if (wantRefs) {
              tasks.push(
                getReferences(normId, per_seed, 0)
                  .then((r) => r.papers.forEach((p) => addCandidate(id, "reference", p)))
                  .catch(() => undefined),
              );
            }
            if (wantCits) {
              tasks.push(
                getCitations(normId, per_seed, 0, "citationCount")
                  .then((r) => r.papers.forEach((p) => addCandidate(id, "citation", p)))
                  .catch(() => undefined),
              );
            }
            if (wantSim) {
              tasks.push(
                getSimilar(normId, per_seed)
                  .then((r) => r.papers.forEach((p) => addCandidate(id, "similar", p)))
                  .catch(() => undefined),
              );
            }
            if (wantCoupling) {
              tasks.push(
                bibliographicCoupling(normId, { maxRefs: NETWORK_BIBLIO_REFS, perRef: NETWORK_BIBLIO_PERREF, limit: per_seed })
                  .then((rs) => rs.forEach((s) => addCandidate(id, "coupling", s.paper)))
                  .catch(() => undefined),
              );
            }
            if (wantCocitation) {
              tasks.push(
                coCitation(normId, { maxCiters: NETWORK_BIBLIO_CITERS, perCiter: NETWORK_BIBLIO_PERCITER, limit: per_seed })
                  .then((rs) => rs.forEach((s) => addCandidate(id, "cocitation", s.paper)))
                  .catch(() => undefined),
              );
            }
            await Promise.all(tasks);
          }),
        );

        // 3) Rank: most seeds connected, then most cited.
        const ranked = [...candidates.values()].sort((a, b) => {
          const byConn = b.connectedTo.size - a.connectedTo.size;
          if (byConn !== 0) return byConn;
          return (b.paper.citationCount ?? 0) - (a.paper.citationCount ?? 0);
        });

        const top = ranked.slice(0, limit);
        const results = top.map((c) => ({
          ...toListItem(c.paper),
          connected_to: [...c.connectedTo],
          connection_count: c.connectedTo.size,
          via: [...c.via],
        }));

        const structured = {
          seeds: resolved.map((r) => ({ id: r.id, resolved: Boolean(r.paper), title: r.paper?.title ?? null })),
          candidate_count: candidates.size,
          results,
        };

        const lines = [
          `# Network expansion of ${liveSeeds.length} seed(s)`,
          "",
          `Seeds: ${resolved.map((r) => (r.paper ? `“${r.paper.title}”` : `${r.id} (unresolved)`)).join("; ")}`,
          `Found ${candidates.size} unique candidate(s); showing top ${results.length}.`,
          "",
        ];
        results.forEach((r, i) => {
          lines.push(
            `${i + 1}. **${r.title}** (${r.year ?? "n.d."}) — connected to ${r.connection_count} seed(s) via ${r.via.join("/")} · ${r.citationCount ?? "?"} citations · id: \`${r.doi ?? r.paperId ?? r.openAlexId ?? "?"}\``,
          );
        });

        return buildResult(structured, lines.join("\n"), response_format as ResponseFormat);
      } catch (error) {
        return errorResult(`Error expanding network: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
