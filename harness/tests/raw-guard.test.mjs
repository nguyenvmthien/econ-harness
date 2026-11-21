#!/usr/bin/env node
/**
 * Tests for the Claude Code / Codex raw-data guard (harness/claude/hooks/ae-raw-guard.mjs).
 * Checks the decision function and the real hook process (stdin JSON -> exit code).
 *   node harness/tests/raw-guard.test.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decide } from "../claude/hooks/ae-raw-guard.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "claude", "hooks", "ae-raw-guard.mjs");
const cwd = "/work/econ/projects/demo";
const cases = [
  // [description, event, shouldBlock]
  ["Write into data/raw (relative)", { tool_name: "Write", tool_input: { file_path: "data/raw/x.csv" } }, true],
  ["Write into data/raw (Windows abs)", { tool_name: "Write", tool_input: { file_path: "C:\\Users\\u\\econ\\projects\\demo\\data\\raw\\x.csv" } }, true],
  ["Edit data/raw file", { tool_name: "Edit", tool_input: { file_path: "/work/econ/projects/demo/data/raw/a.csv" } }, true],
  ["MultiEdit DATA/RAW (case)", { tool_name: "MultiEdit", tool_input: { file_path: "Data/Raw/a.csv" } }, true],
  ["Write data/intermediate", { tool_name: "Write", tool_input: { file_path: "data/intermediate/x.csv" } }, false],
  ["Write data/raw_notes.md (not raw dir)", { tool_name: "Write", tool_input: { file_path: "data/raw_notes.md" } }, false],
  ["Write R script", { tool_name: "Write", tool_input: { file_path: "R/01_build.R" } }, false],
  ["Bash rm in raw", { tool_name: "Bash", tool_input: { command: "rm data/raw/x.csv" } }, true],
  ["Bash redirect into raw", { tool_name: "Bash", tool_input: { command: "echo hi > data/raw/x.csv" } }, true],
  ["Bash Rscript writing raw", { tool_name: "Bash", tool_input: { command: "Rscript -e 'write.csv(d, \"data/raw/x.csv\")'" } }, true],
  ["Bash chained mutate", { tool_name: "Bash", tool_input: { command: "ls && mv a.csv data/raw/" } }, true],
  ["PowerShell Remove-Item", { tool_name: "PowerShell", tool_input: { command: "Remove-Item data\\raw\\x.csv" } }, true],
  ["Bash read raw", { tool_name: "Bash", tool_input: { command: "head -5 data/raw/x.csv" } }, false],
  ["Bash Rscript read raw", { tool_name: "Bash", tool_input: { command: "Rscript -e 'nrow(read.csv(\"data/raw/x.csv\"))'" } }, false],
  ["Bash unrelated rm", { tool_name: "Bash", tool_input: { command: "rm scratch/tmp.R" } }, false],
  ["Read tool", { tool_name: "Read", tool_input: { file_path: "data/raw/x.csv" } }, false],
  ["Codex apply_patch add in raw", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Add File: data/raw/x.csv\n+a\n*** End Patch" } }, true],
  ["Codex apply_patch update raw (Windows)", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: data\\raw\\x.csv\n@@\n-a\n+b\n*** End Patch" } }, true],
  ["Codex apply_patch delete raw", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Delete File: /work/econ/projects/demo/data/raw/x.csv\n*** End Patch" } }, true],
  ["Codex apply_patch move into raw", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: scratch/x.csv\n*** Move to: data/raw/x.csv\n*** End Patch" } }, true],
  ["Codex apply_patch R script", { tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: R/01_build.R\n@@\n-x <- read.csv('data/raw/a.csv')\n+x <- read.csv('data/raw/b.csv')\n*** End Patch" } }, false],
];

let failed = 0;
for (const [name, event, expect] of cases) {
  const got = decide({ cwd, ...event }) !== null;
  const proc = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ cwd, ...event }), encoding: "utf8" });
  const procBlocked = proc.status === 2;
  const ok = got === expect && procBlocked === expect;
  if (!ok) failed++;
  console.log(`${ok ? "✔" : "✘"} ${name} (expected ${expect ? "block" : "allow"}, decide=${got}, exit=${proc.status})`);
}
const junk = spawnSync(process.execPath, [HOOK], { input: "not json", encoding: "utf8" });
if (junk.status !== 0) { failed++; console.log("✘ malformed input must fail open"); } else console.log("✔ malformed input fails open");

if (failed) { console.error(`${failed} raw-guard case(s) failed`); process.exit(1); }
console.log("raw-guard: all cases passed");
