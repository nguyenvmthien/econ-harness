# econ-harness

A workspace for applied economics research in R with AI agents: literature search, research design, data cleaning, estimation, manuscript writing and review.

- **Main agent:** Claude Code running inside [Orca](https://github.com/stablyai/orca). Codex and opencode read `AGENTS.md`; omp is optional.
- **Portable:** no absolute paths and no API keys in the repository, so it works wherever it is cloned.
- **Raw data is protected:** agents cannot write to `data/raw`; a hook blocks every write there.

## Installation

Windows is the main machine:

```powershell
git clone https://github.com/<user>/econ-harness.git C:\econ
cd C:\econ
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

On macOS (for testing): `./setup-mac.sh`.

Both scripts end by running `node harness/setup/setup.mjs`, which builds the MCP server, generates `.claude/`, installs R packages, registers the MCP server and verifies the result. It is safe to rerun. Full guide and checklist: [docs/install-windows.md](docs/install-windows.md).

**Requirements:** R 4.6 (plus Rtools46 on Windows), RStudio, Quarto, Git, Node.js 18 or later. Python 3 is only needed to import journal rankings.

## Usage

Open the workspace in Orca, pick the Claude agent, then:

```
/ae-new fdi_vn        # create projects/fdi_vn from template/ (its own Git repository)
```

Open `projects/fdi_vn` as a separate workspace and work through the steps:

```mermaid
flowchart LR
  new --> lit --> plan --> data --> estimate --> write --> review --> final
  data -.-> phacking -.-> hark -.-> write
```

| Step | Commands |
|---|---|
| Create a project | `/ae-new <slug>` |
| Literature and citations | `/ae-lit`, `/ae-cite <DOI>` |
| Research design | `/ae-plan`, `/ae-exogenous [question]` |
| Data and estimation | `/ae-data`, `/ae-estimate`, `/ae-consolidate` |
| Exploration | `/ae-phacking [scope]`, `/ae-hark [ID...]` |
| Writing, review, release | `/ae-write <section>`, `/ae-review`, `/ae-final [style]` |

Details for each step, exporting tables and rendering the manuscript: [docs/workflow.md](docs/workflow.md).

## Layout

```
AGENTS.md, CLAUDE.md     rules for agents (all agents / Claude Code only)
harness/
  commands/ agents/ skills/   sources for 13 commands, 7 subagents, 9 skills
  claude/                     Claude Code hook and settings.json
  mcp/research-discovery/     literature MCP server (Semantic Scholar, OpenAlex, Elsevier, SJR/ABDC)
  scripts/sync-agents.mjs     generates .claude/ from the sources above
  setup/                      setup.mjs, install-packages.R
  tests/                      hook and audit tests
template/                project skeleton that /ae-new copies to projects/<slug>
docs/                    installation and workflow guides
```

`.claude/` and `template/.claude/` are **generated**. To change a command, agent or skill, edit it in `harness/`, then run:

```bash
node harness/scripts/sync-agents.mjs            # add --projects to update existing projects too
node harness/tests/raw-guard.test.mjs
node harness/scripts/sync-agents.mjs --check
```

`projects/` and `data_hub/` are not part of this repository: each project is its own Git repository.
