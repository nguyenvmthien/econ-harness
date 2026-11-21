#!/usr/bin/env node
/**
 * Generate the Claude Code layer (.claude/) from the canonical harness sources.
 *
 *   harness/commands/ae-*.md   -> .claude/commands/ae-*.md   (verbatim)
 *   harness/agents/ae-*.md     -> .claude/agents/ae-*.md     (omp frontmatter -> Claude Code frontmatter)
 *   harness/skills/ae-* /      -> .claude/skills/ae-* /       (verbatim, recursive)
 *   harness/claude/hooks/*     -> .claude/hooks/*
 *   harness/claude/settings.json -> .claude/settings.json
 *
 * Targets: the workspace root and template/ (so `/ae-new` copies a self-contained project).
 *
 *   node harness/scripts/sync-agents.mjs              write root + template
 *   node harness/scripts/sync-agents.mjs --projects   also refresh projects/<slug>/.claude
 *   node harness/scripts/sync-agents.mjs --check      exit 1 if any generated file is stale
 *
 * Never edit .claude/ by hand: edit harness/ and rerun this script.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const H = join(ROOT, "harness");
const args = new Set(process.argv.slice(2));
const CHECK = args.has("--check");

// omp model tiers -> Claude Code model aliases.
const MODEL_MAP = { "@default": "inherit", "@slow": "opus" };
// Agents whose contract says they never edit files: deny the edit tools as a hard backstop.
const READ_ONLY = new Set(["ae-citation-check", "ae-data-auditor", "ae-lit-scout", "ae-referee", "ae-writer"]);

const lf = (s) => s.replace(/\r\n/g, "\n");

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name === ".DS_Store") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

function splitFrontmatter(text, file) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(lf(text));
  if (!m) throw new Error(`No frontmatter in ${file}`);
  const fields = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`Unsupported frontmatter line in ${file}: ${line}`);
    fields[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1").trim();
  }
  return { fields, body: m[2] };
}

function convertAgent(text, file) {
  const { fields, body } = splitFrontmatter(text, file);
  for (const k of ["name", "description"]) if (!fields[k]) throw new Error(`${file}: missing ${k}`);
  const firstTier = (fields.model ?? "@default").split(",")[0].trim();
  const model = MODEL_MAP[firstTier] ?? "inherit";
  const lines = ["---", `name: ${fields.name}`, `description: ${JSON.stringify(fields.description)}`, `model: ${model}`];
  if (fields["autoload-skills"]) lines.push(`skills: ${fields["autoload-skills"]}`);
  if (READ_ONLY.has(fields.name)) lines.push("disallowedTools: Write, Edit, MultiEdit, NotebookEdit");
  lines.push("---");
  const note = `<!-- GENERATED from harness/agents/${fields.name}.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->\n`;
  return `${lines.join("\n")}\n${note}${body}`;
}

/** Build the full map of { relativePath: content } that belongs in a .claude/ directory. */
function buildLayer() {
  const files = new Map();
  for (const f of listFiles(join(H, "commands"))) {
    if (!/ae-.*\.md$/.test(f)) continue;
    files.set(join("commands", relative(join(H, "commands"), f)), lf(readFileSync(f, "utf8")));
  }
  for (const f of listFiles(join(H, "agents"))) {
    if (!/ae-.*\.md$/.test(f)) continue;
    files.set(join("agents", relative(join(H, "agents"), f)), convertAgent(readFileSync(f, "utf8"), f));
  }
  for (const f of listFiles(join(H, "skills"))) {
    const rel = relative(join(H, "skills"), f);
    if (!rel.startsWith("ae-")) continue;
    files.set(join("skills", rel), lf(readFileSync(f, "utf8")));
  }
  for (const f of listFiles(join(H, "claude"))) {
    files.set(relative(join(H, "claude"), f), lf(readFileSync(f, "utf8")));
  }
  return files;
}

/** Generated subtrees are owned entirely by this script; stale files inside them are removed. */
const OWNED = ["commands", "agents", "skills", "hooks"];

function syncTarget(targetRoot, layer) {
  const base = join(targetRoot, ".claude");
  const problems = [];
  for (const [rel, content] of layer) {
    const p = join(base, rel);
    const current = existsSync(p) ? lf(readFileSync(p, "utf8")) : null;
    if (current === content) continue;
    if (CHECK) { problems.push(`${current === null ? "missing" : "stale"}: ${relative(ROOT, p)}`); continue; }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  for (const sub of OWNED) {
    const dir = join(base, sub);
    if (!existsSync(dir)) continue;
    for (const f of listFiles(dir)) {
      if (layer.has(relative(base, f))) continue;
      if (CHECK) problems.push(`extra: ${relative(ROOT, f)}`);
      else rmSync(f);
    }
  }
  return problems;
}

const layer = buildLayer();
const targets = [ROOT, join(ROOT, "template")];
if (args.has("--projects") && existsSync(join(ROOT, "projects"))) {
  for (const slug of readdirSync(join(ROOT, "projects"))) {
    const p = join(ROOT, "projects", slug);
    if (statSync(p).isDirectory() && existsSync(join(p, "PLAN.md"))) targets.push(p);
  }
}

const problems = targets.flatMap((t) => syncTarget(t, layer));
if (CHECK) {
  if (problems.length) {
    console.error(`.claude/ is out of date (run: node harness/scripts/sync-agents.mjs)\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`OK: .claude/ up to date in ${targets.length} target(s), ${layer.size} files each.`);
} else {
  console.log(`Synced ${layer.size} files into .claude/ of: ${targets.map((t) => relative(ROOT, t) || ".").join(", ")}`);
}
