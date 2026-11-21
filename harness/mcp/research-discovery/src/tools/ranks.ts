import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildResult, errorResult } from "../format.js";
import { searchJournalRanks, rankSources } from "../journalRanks.js";
import { ResponseFormat, responseFormatInput } from "../schemas.js";

export function registerJournalRankTools(server: McpServer): void {
  server.registerTool(
    "journal_rank_lookup",
    {
      title: "Look up journal ranks",
      description: `Look up local journal rank metadata by journal title or ISSN. Uses the imported 2025 SCImago Q1/Q2 and ABDC A*/A/B datasets; no upstream API request is made. SJR quartiles and ABDC ratings are separate systems and are never converted into each other. For ABDC, optionally restrict to a four-digit Field of Research code (e.g. 3801 economics).`,
      inputSchema: {
        query: z.string().min(3).max(200).describe("Journal title or ISSN (print or online)."),
        source: z.enum(["SJR", "ABDC"]).optional().describe("Optional ranking system filter."),
        field_of_research: z.string().regex(/^\d{4}$/).optional().describe("ABDC FoR code; requires source='ABDC'."),
        limit: z.number().int().min(1).max(50).default(20).describe("Maximum rows returned (default 20)."),
        response_format: responseFormatInput,
      },
      annotations: { title: "Journal rank lookup", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, source, field_of_research, limit, response_format }) => {
      try {
        if (field_of_research && source !== "ABDC") return errorResult("field_of_research requires source='ABDC'.");
        const results = searchJournalRanks(query, source, limit, field_of_research);
        if (!results.length) return errorResult(`No 2025 SJR Q1/Q2 or ABDC A*/A/B record matched '${query}'. Try the journal's exact ISSN or a longer title fragment.`);
        const sources = rankSources();
        const structured = { query, sources, results };
        const markdown = [
          `# Journal rank lookup — ${results.length} result(s)`,
          "",
          ...results.map((row) => {
            const subject = row.subjectCategories?.length
              ? ` · ${row.subjectCategories.map((category) => `${category.name} (${category.quartile})`).join("; ")}`
              : row.fieldOfResearch ? ` · FoR ${row.fieldOfResearch}` : "";
            return `- **${row.title}** — ${row.source} ${row.rank} (${row.year})${row.sjr ? ` · SJR ${row.sjr}` : ""} · ISSN ${row.issns.join(", ") || "not listed"}${subject}`;
          }),
          "",
          ...[...new Set(results.map((row) => row.source))].map((key) => `Source: ${sources[key].attribution} — ${sources[key].sourceUrl}`),
        ].join("\n");
        return buildResult(structured, markdown, response_format as ResponseFormat);
      } catch (error) {
        return errorResult(`Error looking up journal rank: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
