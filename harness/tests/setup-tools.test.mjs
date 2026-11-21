#!/usr/bin/env node

import assert from "node:assert/strict";
import { toolDefinitions } from "../setup/tools.mjs";

for (const platform of ["win32", "darwin", "linux"]) {
  const tools = toolDefinitions(platform);
  assert.deepEqual(tools.codex, ["--version", false], `Codex is optional on ${platform}`);
  assert.deepEqual(tools.claude, ["--version", false], `Claude is optional on ${platform}`);
  assert.deepEqual(tools[platform === "win32" ? "python" : "python3"], ["--version", false]);
}

console.log("setup-tools: Claude and Codex are optional prerequisites on all platforms");
