import { resolve } from "node:path";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
// Workspace root from the ECON_ROOT environment variable (set by setup); empty = guard data/raw everywhere.
const ENV_ROOT = (process.env.ECON_ROOT ?? "").trim().replace(/\\/g, "/").toLowerCase();
const ECON_ROOT = ENV_ROOT ? ENV_ROOT.replace(/\/?$/, "/") : "";
const RAW = /\/data\/raw(\/|$)/;
const MSG = "ae-raw-guard: data/raw is read-only for agents. Add raw sources with R/00_download.R or ask the user to place the file, then register it in data/RAW_MANIFEST.csv with ae_register_raw().";
const MUTATING = /\b(rm|del|erase|rmdir|rd|mv|move|ren|rename|cp|xcopy|robocopy|Remove-Item|Move-Item|Rename-Item|Copy-Item|Set-Content|Add-Content|Out-File|New-Item|Clear-Content|write\.csv|write\.table|fwrite|saveRDS|writeLines|write_csv|write_rds|write_dta|write_xlsx|file\.remove|file\.rename|file\.copy|file\.create|unlink|download\.file|to_csv|to_parquet|to_excel)\b/i;
function targetPaths(tool: string, input: unknown): string[] {
  if (tool === "write" && input && typeof input === "object" && !Array.isArray(input)) { const path = (input as Record<string, unknown>).path; return typeof path === "string" ? [path] : []; }
  if (tool !== "edit") return [];
  const patch = typeof input === "string" ? input : input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>).input : "";
  return typeof patch === "string" ? [...patch.matchAll(/^\[([^\n#\]]+)#[0-9A-F]{4}\]\s*$/gim)].map(m => m[1].trim()) : [];
}
export default function aeRawGuard(pi: ExtensionAPI): void {
  pi.setLabel("AE Raw Guard");
  pi.on("tool_call", async (event, ctx) => {
    const tool = event.toolName; const input = event.input;
    if (tool === "write" || tool === "edit") {
      for (const p of targetPaths(tool, input)) { const abs = resolve(ctx.cwd, p).replace(/\\/g, "/").toLowerCase(); if ((!ECON_ROOT || abs.startsWith(ECON_ROOT)) && RAW.test(abs)) return { block: true, reason: MSG }; }
      return;
    }
    if (tool !== "bash" && tool !== "eval" && tool !== "python") return;
    const obj = input && typeof input === "object" ? input as Record<string, unknown> : {};
    const field = tool === "bash" ? obj.command : obj.code;
    const text = typeof field === "string" ? field : JSON.stringify(input);
    const cwd = ctx.cwd.replace(/\\/g, "/").toLowerCase();
    if (ECON_ROOT && !cwd.startsWith(ECON_ROOT) && !text.toLowerCase().includes("/econ/") && !text.toLowerCase().includes("\\econ\\")) return;
    for (const line of text.split(/\r?\n|;/)) {
      if (!/data[\\/]+raw/i.test(line) || !MUTATING.test(line)) continue;
      if (tool === "bash" && /(^|[^|=<\-])>>?\s*["']?[^\s"']*data[\\/]+raw/i.test(line)) return { block: true, reason: MSG };
      return { block: true, reason: MSG };
    }
  });
}
