#!/usr/bin/env node
/**
 * research-discovery MCP server.
 *
 * A ResearchRabbit-style literature-discovery engine built on two free, public,
 * ToS-compliant APIs: the Semantic Scholar Graph API and OpenAlex, plus the Elsevier
 * API (when ELSEVIER_API_KEY is set) to fill abstracts those two elide. Start from a
 * seed paper, then expand to Similar / Earlier (references) / Later (citations)
 * work and the author network — all read-only.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { hasElsevierKey, hasOpenAlexEmail, hasSemanticScholarKey, pruneDiskCache } from "./apiClient.js";
import { registerAuthorTools } from "./tools/authors.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerPaperTools } from "./tools/papers.js";
import { registerTopicTools } from "./tools/topic.js";
import { registerJournalRankTools } from "./tools/ranks.js";

function createServer(): McpServer {
  const server = new McpServer({ name: "research-discovery-mcp-server", version: "1.0.0" });
  registerPaperTools(server);
  registerAuthorTools(server);
  registerNetworkTools(server);
  registerJournalRankTools(server);
  registerTopicTools(server);
  return server;
}

async function main(): Promise<void> {
  // Logging MUST go to stderr — stdout is reserved for the MCP protocol.
  if (!hasOpenAlexEmail()) {
    console.error(
      "[research-discovery] WARNING: OPENALEX_EMAIL is not set. OpenAlex requests will use the anonymous pool " +
        "(lower reliability). Set OPENALEX_EMAIL to your email to join the polite pool.",
    );
  }
  if (!hasSemanticScholarKey()) {
    console.error(
      "[research-discovery] NOTE: SEMANTIC_SCHOLAR_API_KEY is not set. Semantic Scholar will be heavily rate-limited; " +
        "the server retries with backoff and falls back to OpenAlex, but a free key is recommended for heavy use.",
    );
  }
  if (!hasElsevierKey()) {
    console.error(
      "[research-discovery] NOTE: ELSEVIER_API_KEY is not set. paper_get cannot fill abstracts for Elsevier (ScienceDirect) DOIs.",
    );
  }

  const server = createServer();
  void pruneDiskCache();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[research-discovery] MCP server running on stdio.");
}

main().catch((error) => {
  console.error("[research-discovery] Fatal error:", error);
  process.exit(1);
});

export { createServer };
