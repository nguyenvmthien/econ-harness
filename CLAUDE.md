@AGENTS.md

# Claude Code / Orca

- The harness sources live in `harness/` (commands, agents, skills, hook). `.claude/` at the root and `template/.claude/` are **generated** by `node harness/scripts/sync-agents.mjs`; never edit them by hand. Edit `harness/`, rerun the sync, and commit both.
- Run `/ae-new <slug>` at the workspace root. Every other research command runs **inside the project**: open `projects/<slug>` as its own workspace in Orca (or `cd projects/<slug>` and run `claude`). Each project carries a copy of `.claude/` from the template; refresh older projects with `node harness/scripts/sync-agents.mjs --projects`.
- The `research_discovery` MCP server (tools `mcp__research_discovery__*`) is registered at user scope by `harness/setup/setup.mjs`. API keys come only from environment variables and are never written to the repository.
- Writes to `data/raw` are blocked by the PreToolUse hook `.claude/hooks/ae-raw-guard.mjs`. If it blocks something by mistake, tell the user; do not work around it with another script.
- Subagents are the `ae-*` files in `.claude/agents/`. In Orca, independent reviews (`ae-referee`, `ae-citation-check`) can be handed to another agent such as Codex through Orca orchestration.
- After changing the harness, run `node harness/tests/raw-guard.test.mjs`, `node harness/scripts/sync-agents.mjs --check` and `Rscript harness/tests/audit-smoke.R`.
