#!/usr/bin/env node
/**
 * One-shot, re-runnable setup for the econ harness (Windows and macOS). Run from anywhere:
 *
 *   node harness/setup/setup.mjs [--skip-r] [--no-register] [--offline] [--no-verify]
 *
 *   1. check prerequisites (node, git, Rscript, quarto, pandoc, python, claude, orca)
 *   2. generate .claude/ (Claude Code layer) from harness/            -> harness/scripts/sync-agents.mjs
 *   3. build the research-discovery MCP server (npm ci + build)
 *   4. write machine-local omp configs (.omp/config.yml, template/.omp/config.yml; git-ignored)
 *   5. create template/paper/reference.docx with pandoc if it is missing
 *   6. install R packages                                              (--skip-r to skip)
 *   7. register the MCP server for Claude Code (user scope) and Codex   (--no-register to skip)
 *      API keys come ONLY from env vars OPENALEX_EMAIL, SEMANTIC_SCHOLAR_API_KEY, ELSEVIER_API_KEY;
 *      they are stored in the agent's user config, never in this repository.
 *   8. verify: raw-guard tests, .claude sync check, audit-smoke.R, MCP protocol test (--offline skips it)
 *
 * Exit code 1 if a required step fails. Every step prints PASS / WARN / FAIL / SKIP.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MCP_DIR = join(ROOT, "harness", "mcp", "research-discovery");
const MCP_ENTRY = join(MCP_DIR, "dist", "index.js");
const WIN = process.platform === "win32";
const flags = new Set(process.argv.slice(2));
const KEYS = ["OPENALEX_EMAIL", "SEMANTIC_SCHOLAR_API_KEY", "ELSEVIER_API_KEY"];
const fwd = (p) => p.replace(/\\/g, "/");

const results = [];
function report(status, step, detail = "") {
  results.push({ status, step, detail });
  console.log(`[${status}] ${step}${detail ? " — " + detail : ""}`);
}

function quote(a) {
  return /[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}
/** Run a command; on Windows go through the shell so npm/claude/codex .cmd shims resolve. */
function run(cmd, args = [], opts = {}) {
  const res = WIN
    ? spawnSync([cmd, ...args].map(quote).join(" "), { shell: true, encoding: "utf8", cwd: opts.cwd ?? ROOT, stdio: opts.stdio ?? "pipe", env: opts.env ?? process.env })
    : spawnSync(cmd, args, { encoding: "utf8", cwd: opts.cwd ?? ROOT, stdio: opts.stdio ?? "pipe", env: opts.env ?? process.env });
  return { ok: res.status === 0, status: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}`.trim(), error: res.error };
}
const has = (cmd) => run(WIN ? "where" : "which", [cmd]).ok;
const firstLine = (s) => (s ?? "").split(/\r?\n/).find((l) => l.trim()) ?? "";
const tail = (s, n = 15) => (s ?? "").split(/\r?\n/).slice(-n).join("\n");

console.log(`econ harness setup — root: ${ROOT}\n`);

// 1. Prerequisites ---------------------------------------------------------------------------
const nodeMajor = Number(process.versions.node.split(".")[0]);
report(nodeMajor >= 18 ? "PASS" : "FAIL", "node >= 18", process.version);
const tools = {
  git: ["--version", true],
  Rscript: ["--version", true],
  quarto: ["--version", true],
  pandoc: ["--version", true],
  [WIN ? "python" : "python3"]: ["--version", false],
  claude: ["--version", false],
};
const present = {};
for (const [cmd, [arg, required]] of Object.entries(tools)) {
  present[cmd] = has(cmd);
  if (!present[cmd]) {
    report(required ? "FAIL" : "WARN", `${cmd} on PATH`, required ? "not found — install it, open a NEW terminal, rerun" : "not found (optional)");
    continue;
  }
  report("PASS", `${cmd} on PATH`, firstLine(run(cmd, [arg]).out));
}
present.orca = has("orca");
report(present.orca ? "PASS" : "WARN", "orca CLI on PATH", present.orca ? "" : "optional; add the workspace in the Orca app instead");
if (results.some((r) => r.status === "FAIL" && r.step.startsWith("node"))) process.exit(1);

// 2. Claude Code layer -----------------------------------------------------------------------
{
  const r = run(process.execPath, [join(ROOT, "harness", "scripts", "sync-agents.mjs"), "--projects"]);
  report(r.ok ? "PASS" : "FAIL", "generate .claude/ from harness/", r.ok ? firstLine(r.out) : tail(r.out));
}

// 3. MCP server --------------------------------------------------------------------------------
{
  const install = existsSync(join(MCP_DIR, "package-lock.json")) ? run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: MCP_DIR }) : run("npm", ["install", "--no-audit", "--no-fund"], { cwd: MCP_DIR });
  if (!install.ok) report("FAIL", "MCP npm install", tail(install.out));
  else {
    const build = run("npm", ["run", "build"], { cwd: MCP_DIR });
    report(build.ok && existsSync(MCP_ENTRY) ? "PASS" : "FAIL", "MCP build (dist/index.js)", build.ok ? fwd(MCP_ENTRY) : tail(build.out));
  }
}

// 4. omp configs (optional agent; machine-local, git-ignored) ------------------------------------
{
  const yml = `skills:\n  customDirectories:\n    - ${fwd(join(ROOT, "harness", "skills"))}\n  includeSkills:\n    - "ae-*"\n`;
  for (const dir of [join(ROOT, ".omp"), join(ROOT, "template", ".omp")]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "config.yml"), yml);
  }
  report("PASS", "omp configs (.omp/config.yml)", "only used if you run omp");
}

// 5. reference.docx --------------------------------------------------------------------------
{
  const docx = join(ROOT, "template", "paper", "reference.docx");
  if (existsSync(docx)) report("PASS", "template/paper/reference.docx", "exists");
  else if (!present.pandoc) report("FAIL", "template/paper/reference.docx", "pandoc missing");
  else {
    const r = run("pandoc", ["-o", docx, "--print-default-data-file", "reference.docx"]);
    report(r.ok ? "PASS" : "FAIL", "template/paper/reference.docx", r.ok ? "created — open it in Word once, adjust styles, commit" : tail(r.out));
  }
}

// 6. R packages ------------------------------------------------------------------------------
if (flags.has("--skip-r")) report("SKIP", "R packages", "--skip-r");
else if (!present.Rscript) report("FAIL", "R packages", "Rscript not on PATH");
else {
  console.log("\nInstalling R packages (first run takes 10–30 minutes)...");
  const r = run("Rscript", [join(ROOT, "harness", "setup", "install-packages.R")], { stdio: "inherit" });
  report(r.ok ? "PASS" : "FAIL", "R packages", r.ok ? "core OK (see report above for method packages)" : "core packages missing — see output above");
}

// 7. MCP registration ------------------------------------------------------------------------
if (flags.has("--no-register")) report("SKIP", "register MCP", "--no-register");
else {
  const envPairs = KEYS.filter((k) => process.env[k]?.trim()).map((k) => `${k}=${process.env[k].trim()}`);
  if (!process.env.OPENALEX_EMAIL?.trim()) report("WARN", "OPENALEX_EMAIL", "not set — OpenAlex uses the slower anonymous pool");
  const entry = fwd(MCP_ENTRY);
  if (present.claude) {
    run("claude", ["mcp", "remove", "research_discovery", "-s", "user"]);
    const r = run("claude", ["mcp", "add", "-s", "user", "research_discovery", ...envPairs.flatMap((e) => ["-e", e]), "--", "node", entry]);
    report(r.ok ? "PASS" : "FAIL", "register MCP for Claude Code (user scope)", r.ok ? `keys: ${envPairs.map((e) => e.split("=")[0]).join(", ") || "none"}` : tail(r.out));
  } else report("SKIP", "register MCP for Claude Code", "claude not found");
  if (has("codex")) {
    run("codex", ["mcp", "remove", "research_discovery"]);
    const r = run("codex", ["mcp", "add", "research_discovery", ...envPairs.flatMap((e) => ["--env", e]), "--", "node", entry]);
    report(r.ok ? "PASS" : "WARN", "register MCP for Codex", r.ok ? "" : tail(r.out));
  }
}

// 8. Verification ----------------------------------------------------------------------------
if (flags.has("--no-verify")) report("SKIP", "verification", "--no-verify");
else {
  let r = run(process.execPath, [join(ROOT, "harness", "tests", "raw-guard.test.mjs")]);
  report(r.ok ? "PASS" : "FAIL", "raw-guard hook tests", r.ok ? firstLine(r.out.split("\n").pop()) : tail(r.out));
  r = run(process.execPath, [join(ROOT, "harness", "scripts", "sync-agents.mjs"), "--check"]);
  report(r.ok ? "PASS" : "FAIL", ".claude/ in sync with harness/", firstLine(r.out));
  if (present.Rscript && !flags.has("--skip-r")) {
    r = run("Rscript", [join("harness", "tests", "audit-smoke.R")]);
    report(r.ok ? "PASS" : "FAIL", "Rscript harness/tests/audit-smoke.R", r.ok ? "exit 0" : tail(r.out));
  } else report("SKIP", "audit-smoke.R", "R not available or --skip-r");
  if (flags.has("--offline")) report("SKIP", "MCP protocol test", "--offline");
  else if (existsSync(MCP_ENTRY)) {
    console.log("\nRunning MCP protocol test (network, ~1–3 min)...");
    r = run(process.execPath, [join("scripts", "protocol-test.mjs")], { cwd: MCP_DIR });
    report(r.ok ? "PASS" : "FAIL", "MCP protocol test", r.ok ? "all tools answered" : tail(r.out));
  }
}

// Summary --------------------------------------------------------------------------------------
const fails = results.filter((r) => r.status === "FAIL");
const warns = results.filter((r) => r.status === "WARN");
console.log(`\n== Summary: ${results.length - fails.length - warns.length} ok, ${warns.length} warning(s), ${fails.length} failure(s) ==`);
for (const r of [...fails, ...warns]) console.log(`  [${r.status}] ${r.step}${r.detail ? " — " + firstLine(r.detail) : ""}`);
if (!fails.length) {
  console.log("\nNext: open this folder in Orca (or run `claude` here), then `/ae-new smoke` and follow docs/CAI-DAT-WINDOWS.md §5.");
}
process.exit(fails.length ? 1 : 0);
