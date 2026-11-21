#!/usr/bin/env node
/**
 * ae-raw-guard (Claude Code PreToolUse hook): data/raw is read-only for agents.
 * Port of harness/extensions/ae-raw-guard.ts (omp) — same rules, no hard-coded paths.
 *
 * Blocks (exit 2 + reason on stderr):
 *   - Write / Edit / MultiEdit / NotebookEdit whose target path contains a `data/raw` segment;
 *   - Bash / PowerShell commands where one line mentions data/raw AND a mutating verb or a
 *     redirection into data/raw.
 * Reading data/raw is always allowed. Fails open on malformed input (never blocks by accident).
 */
import { isAbsolute, resolve } from "node:path";

const RAW = /(^|\/)data\/raw(\/|$)/;
const MSG =
  "ae-raw-guard: data/raw is read-only for agents. Add raw sources with R/00_download.R or ask the user to place the file, " +
  "then register it in data/RAW_MANIFEST.csv with ae_register_raw().";
const MUTATING =
  /\b(rm|del|erase|rmdir|rd|mv|move|ren|rename|cp|xcopy|robocopy|tee|touch|truncate|sed\s+-i|Remove-Item|Move-Item|Rename-Item|Copy-Item|Set-Content|Add-Content|Out-File|New-Item|Clear-Content|write\.csv|write\.table|fwrite|saveRDS|writeLines|write_csv|write_rds|write_dta|write_xlsx|file\.remove|file\.rename|file\.copy|file\.create|unlink|download\.file|to_csv|to_parquet|to_excel)\b/i;
const REDIRECT_INTO_RAW = /(^|[^|=<\-])>>?\s*["']?[^\s"']*data[\\/]+raw/i;

const norm = (p) => p.replace(/\\/g, "/");

export function decide(event) {
  const tool = event?.tool_name;
  const input = event?.tool_input ?? {};
  const cwd = typeof event?.cwd === "string" ? event.cwd : process.cwd();

  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const p = input.file_path ?? input.notebook_path;
    if (typeof p !== "string") return null;
    const abs = norm(isAbsolute(p) ? p : resolve(cwd, p)).toLowerCase();
    return RAW.test(abs) ? MSG : null;
  }

  if (tool === "Bash" || tool === "PowerShell") {
    const text = typeof input.command === "string" ? input.command : "";
    for (const line of text.split(/\r?\n|;|&&|\|\|/)) {
      if (!/data[\\/]+raw/i.test(line)) continue;
      if (MUTATING.test(line) || REDIRECT_INTO_RAW.test(line)) return MSG;
    }
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let event;
  try { event = JSON.parse(raw); } catch { process.exit(0); }
  const reason = decide(event);
  if (reason) {
    process.stderr.write(reason + "\n");
    process.exit(2);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("ae-raw-guard.mjs")) main();
