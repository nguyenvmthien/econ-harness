import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  stderr: "ignore",
  env: { ...getDefaultEnvironment(), RESEARCH_DISCOVERY_CACHE_DIR: "off" },
});
const client = new Client({ name: "rank-mcp-test", version: "1.0.0" });

try {
  await client.connect(transport);
  const abdcResponse = await client.callTool({
    name: "journal_rank_lookup",
    arguments: { query: "0002-8282", source: "ABDC", field_of_research: "3801", response_format: "json" },
  });
  assert.equal(abdcResponse.isError, undefined);
  const abdc = JSON.parse(abdcResponse.content[0].text);
  assert.ok(abdc.results.some((row) => row.rank === "A*" && row.fieldOfResearch === "3801"));

  const sjrResponse = await client.callTool({
    name: "journal_rank_lookup",
    arguments: { query: "American Economic Review", source: "SJR", response_format: "json" },
  });
  assert.equal(sjrResponse.isError, undefined);
  const sjr = JSON.parse(sjrResponse.content[0].text);
  assert.ok(sjr.results.some((row) => row.rank === "Q1" && row.subjectCategories.some((category) => category.name === "Economics and Econometrics")));
  console.log("JOURNAL RANK MCP TEST PASSED");
} finally {
  await client.close();
}
