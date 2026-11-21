#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SYNC = join(ROOT, "harness", "scripts", "sync-agents.mjs");

function runSync(...args) {
  return spawnSync(process.execPath, [SYNC, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function skill(root, name) {
  return readFileSync(join(root, ".agents", "skills", name, "SKILL.md"), "utf8");
}

function skillNames(root) {
  return readdirSync(join(root, ".agents", "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const write = runSync();
assert.equal(write.status, 0, write.stderr || write.stdout);

const rootNames = skillNames(ROOT);
const templateNames = skillNames(join(ROOT, "template"));
assert.deepEqual(templateNames, rootNames, "root and template expose the same Codex skills");
assert.equal(rootNames.filter((name) => name === "ae-data").length, 1);
assert.equal(rootNames.filter((name) => name === "ae-review").length, 1);

const data = skill(ROOT, "ae-data");
assert.match(data, /# Data foundation/, "ae-data keeps canonical skill guidance");
assert.match(data, /dispatch one read-only `ae-data-auditor`/, "ae-data includes command workflow");
assert.doesNotMatch(data, /`\/ae-data`/, "Codex skills do not retain Claude slash invocations");
assert.match(data, /\$ae-data/, "Codex workflow references use skill invocation syntax");

const claudeData = readFileSync(join(ROOT, ".claude", "skills", "ae-data", "SKILL.md"), "utf8");
assert.match(claudeData, /`\/ae-data`/, "Claude layer keeps slash command syntax");
assert.doesNotMatch(claudeData, /\$ae-data/, "Codex conversion never leaks into Claude output");

const review = skill(ROOT, "ae-review");
assert.match(review, /# Referee checklist/, "ae-review keeps canonical skill guidance");
assert.match(review, /enumerate every current `\(citekey, complete sentence/, "ae-review includes command workflow");

const estimate = skill(ROOT, "ae-estimate");
assert.match(estimate, /^---\nname: ae-estimate\ndescription: .+\n---\n/);
assert.match(estimate, /Treat the text following `\$ae-estimate` as `\$ARGUMENTS`/);
assert.match(estimate, /spawn a generic subagent and instruct it to use the matching `\$ae-\*` skill/);
assert.doesNotMatch(estimate, /`\/ae-data`/, "cross-workflow references use Codex skill syntax");

const referee = skill(ROOT, "ae-referee");
assert.match(referee, /^---\nname: ae-referee\ndescription: .+\n---\n/);
assert.doesNotMatch(referee, /^model:/m, "specialist skill omits agent-only frontmatter");
assert.match(referee, /Do not edit\. Read PLAN\.md/);

for (const root of [ROOT, join(ROOT, "template")]) {
  const hooks = JSON.parse(readFileSync(join(root, ".codex", "hooks.json"), "utf8"));
  const pre = hooks.hooks.PreToolUse[0];
  assert.match(pre.matcher, /apply_patch/, "Codex hook covers apply_patch edits");
  assert.equal(pre.hooks[0].command, "node .codex/hooks/ae-raw-guard.mjs");
  assert.equal(
    readFileSync(join(root, ".codex", "hooks", "ae-raw-guard.mjs"), "utf8"),
    readFileSync(join(ROOT, ".claude", "hooks", "ae-raw-guard.mjs"), "utf8"),
    "Codex and Claude share one raw-data guard",
  );
}

const keep = join(ROOT, ".agents", "keep.txt");
const stale = join(ROOT, ".agents", "skills", "stale-test", "SKILL.md");
try {
  writeFileSync(keep, "unowned\n");
  mkdirSync(dirname(stale), { recursive: true });
  writeFileSync(stale, "---\nname: stale-test\ndescription: stale\n---\n");

  const check = runSync("--check");
  assert.notEqual(check.status, 0, "check mode rejects stale generated skills");
  assert.match(`${check.stdout}${check.stderr}`, /extra: \.agents\/skills\/stale-test\/SKILL\.md/);

  const clean = runSync();
  assert.equal(clean.status, 0, clean.stderr || clean.stdout);
  assert.equal(existsSync(stale), false, "write sync removes stale generated skills");
  assert.equal(readFileSync(keep, "utf8"), "unowned\n", "write sync preserves unrelated .agents files");
} finally {
  rmSync(keep, { force: true });
  rmSync(dirname(stale), { recursive: true, force: true });
}

console.log(`sync-agents: ${rootNames.length} Codex skills generated and verified`);
