#!/usr/bin/env node
/**
 * Generate the Claude Code (.claude/) and Codex (.agents/skills/) layers from
 * the canonical harness sources.
 *
 *   harness/commands/ae-*.md   -> .claude/commands/ae-*.md   (verbatim)
 *   harness/agents/ae-*.md     -> .claude/agents/ae-*.md     (omp frontmatter -> Claude Code frontmatter)
 *   harness/skills/ae-* /      -> .claude/skills/ae-* /       (verbatim, recursive)
 *   harness/claude/hooks/*     -> .claude/hooks/*
 *   harness/claude/settings.json -> .claude/settings.json
 *
 *   harness/skills/ae-*           -> .agents/skills/ae-* (Codex syntax, recursive)
 *   harness/commands/ae-*.md      -> Codex workflow skill directories
 *   harness/agents/ae-*.md        -> Codex specialist skill directories
 *   harness/codex/hooks.json      -> .codex/hooks.json
 *   harness/claude/hooks/*        -> .codex/hooks/* (shared raw-data guard)
 *
 * Targets: the workspace root and template/ (so `/ae-new` copies a self-contained project).
 *
 *   node harness/scripts/sync-agents.mjs              write root + template
 *   node harness/scripts/sync-agents.mjs --projects   also refresh project agent layers
 *   node harness/scripts/sync-agents.mjs --check      exit 1 if any generated file is stale
 *
 * Never edit .claude/, .agents/skills/ or .codex/ by hand: edit harness/ and rerun this script.
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

function skillHeader(name, description) {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n`;
}

function codexify(text) {
  return text.replace(/(^|[\s(`])\/(ae-[a-z0-9-]+)/gm, (_, prefix, name) => `${prefix}$${name}`);
}

const CODEX_DELEGATION = "If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.";

function commandSkill(name, description, body) {
  const note = `<!-- GENERATED from harness/commands/${name}.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->\n`;
  const args = `Treat the text following \`$${name}\` as \`$ARGUMENTS\` in the workflow below.\n`;
  return `${skillHeader(name, description)}${note}\n# Workflow\n\n${args}\n${CODEX_DELEGATION}\n\n${codexify(body).trim()}\n`;
}

function mergeCommandIntoSkill(skill, name, body) {
  const note = `<!-- Command workflow merged from harness/commands/${name}.md by harness/scripts/sync-agents.mjs. -->`;
  const args = `Treat the text following \`$${name}\` as \`$ARGUMENTS\` in the workflow below.`;
  return `${skill.trimEnd()}\n\n${note}\n\n## Codex workflow entry point\n\n${args}\n\n${CODEX_DELEGATION}\n\n${codexify(body).trim()}\n`;
}

function specialistSkill(text, file) {
  const { fields, body } = splitFrontmatter(text, file);
  for (const k of ["name", "description"]) if (!fields[k]) throw new Error(`${file}: missing ${k}`);
  const note = `<!-- GENERATED from harness/agents/${fields.name}.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->\n`;
  const skills = fields["autoload-skills"]
    ? `\nBefore starting, follow the applicable guidance in these skills: ${fields["autoload-skills"]}.\n`
    : "";
  return `${skillHeader(fields.name, fields.description)}${note}\n# Specialist contract\n${skills}\n${codexify(body).trim()}\n`;
}

/** Build the full map of { relativePath: content } that belongs in a .claude/ directory. */
function buildClaudeLayer() {
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

/** Build repository-scoped Codex skills from the same canonical sources. */
function buildCodexLayer() {
  const files = new Map();
  const skillRoot = join(H, "skills");

  for (const f of listFiles(skillRoot)) {
    const rel = relative(skillRoot, f);
    if (!rel.startsWith("ae-")) continue;
    files.set(join("skills", rel), codexify(lf(readFileSync(f, "utf8"))));
  }

  for (const f of listFiles(join(H, "commands"))) {
    if (!/ae-.*\.md$/.test(f)) continue;
    const name = f.split(/[\\/]/).pop().replace(/\.md$/, "");
    const { fields, body } = splitFrontmatter(readFileSync(f, "utf8"), f);
    if (!fields.description) throw new Error(`${f}: missing description`);
    const rel = join("skills", name, "SKILL.md");
    const current = files.get(rel);
    files.set(rel, current
      ? mergeCommandIntoSkill(current, name, body)
      : commandSkill(name, fields.description, body));
  }

  for (const f of listFiles(join(H, "agents"))) {
    if (!/ae-.*\.md$/.test(f)) continue;
    const { fields } = splitFrontmatter(readFileSync(f, "utf8"), f);
    const rel = join("skills", fields.name, "SKILL.md");
    if (files.has(rel)) throw new Error(`Codex skill name collision: ${fields.name}`);
    files.set(rel, specialistSkill(readFileSync(f, "utf8"), f));
  }

  return files;
}

/** Build the project-scoped Codex config: the PreToolUse hook that enforces the data/raw rule. */
function buildCodexConfigLayer() {
  const files = new Map();
  for (const f of listFiles(join(H, "codex"))) files.set(relative(join(H, "codex"), f), lf(readFileSync(f, "utf8")));
  for (const f of listFiles(join(H, "claude", "hooks"))) files.set(join("hooks", relative(join(H, "claude", "hooks"), f)), lf(readFileSync(f, "utf8")));
  return files;
}

/** Generated subtrees are owned entirely by this script; stale files inside them are removed. */
const CLAUDE_OWNED = ["commands", "agents", "skills", "hooks"];
const CODEX_OWNED = ["skills"];
const CODEX_CONFIG_OWNED = ["hooks"];

function syncLayer(targetRoot, directory, layer, owned) {
  const base = join(targetRoot, directory);
  const problems = [];
  for (const [rel, content] of layer) {
    const p = join(base, rel);
    const current = existsSync(p) ? lf(readFileSync(p, "utf8")) : null;
    if (current === content) continue;
    if (CHECK) { problems.push(`${current === null ? "missing" : "stale"}: ${relative(ROOT, p)}`); continue; }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  for (const sub of owned) {
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

const claudeLayer = buildClaudeLayer();
const codexLayer = buildCodexLayer();
const codexConfigLayer = buildCodexConfigLayer();
const targets = [ROOT, join(ROOT, "template")];
if (args.has("--projects") && existsSync(join(ROOT, "projects"))) {
  for (const slug of readdirSync(join(ROOT, "projects"))) {
    const p = join(ROOT, "projects", slug);
    if (statSync(p).isDirectory() && existsSync(join(p, "PLAN.md"))) targets.push(p);
  }
}

const problems = targets.flatMap((t) => [
  ...syncLayer(t, ".claude", claudeLayer, CLAUDE_OWNED),
  ...syncLayer(t, ".agents", codexLayer, CODEX_OWNED),
  ...syncLayer(t, ".codex", codexConfigLayer, CODEX_CONFIG_OWNED),
]);
if (CHECK) {
  if (problems.length) {
    console.error(`Generated agent layers are out of date (run: node harness/scripts/sync-agents.mjs)\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`OK: generated layers up to date in ${targets.length} target(s): ${claudeLayer.size} Claude files and ${codexLayer.size + codexConfigLayer.size} Codex files each.`);
} else {
  console.log(`Synced ${claudeLayer.size} Claude files and ${codexLayer.size + codexConfigLayer.size} Codex files into: ${targets.map((t) => relative(ROOT, t) || ".").join(", ")}`);
}
