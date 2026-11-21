/**
 * Prerequisite commands checked by setup.mjs: { command: [versionArg, required] }.
 * Agents (Claude Code, Codex) are optional: install at least one of them.
 */
export function toolDefinitions(platform = process.platform) {
  return {
    git: ["--version", true],
    Rscript: ["--version", true],
    quarto: ["--version", true],
    [platform === "win32" ? "python" : "python3"]: ["--version", false],
    claude: ["--version", false],
    codex: ["--version", false],
  };
}
