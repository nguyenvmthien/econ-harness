# Installing on Windows (Orca + Claude Code)

The main agent is **Claude Code** running inside **Orca**. Codex and opencode work through `AGENTS.md`; omp is optional. The repository holds no absolute paths and no API keys.

## 1. What the setup does

| Task | Done by |
|---|---|
| Install Git, Node LTS, R, RStudio, Quarto, Python and Rtools with winget, skipping anything already installed | `setup-windows.ps1` |
| Add `R\bin` to PATH (the R installer does not) | `setup-windows.ps1` |
| Install Orca and Claude Code (asks first) | `setup-windows.ps1` |
| Save `ECON_ROOT`, `OPENALEX_EMAIL`, `SEMANTIC_SCHOLAR_API_KEY` and `ELSEVIER_API_KEY` as **user** environment variables | `setup-windows.ps1` |
| Generate `.claude/`, build the MCP server, create `reference.docx`, install R packages, register the MCP server, verify | `harness/setup/setup.mjs` |
| Add the workspace to Orca | `setup-windows.ps1` if the `orca` CLI is available, otherwise by hand (§3) |

The script is safe to rerun.

## 2. Clone and run the setup

### 2.1 Before you start

- Windows 10/11 or Windows Server 2022+ with **winget** (`winget --version`; if missing, install "App Installer" from the Microsoft Store).
- Git, to clone. If it is missing:
  ```powershell
  winget install --id Git.Git -e --source winget
  ```
  Then **open a new PowerShell window**.
- Pick a **short folder with no spaces, no accented characters and outside OneDrive**, such as `C:\econ`. Long paths and OneDrive often break `renv` and Quarto.

### 2.2 Clone

```powershell
git clone https://github.com/<user>/econ-harness.git C:\econ
cd C:\econ
```

### 2.3 Run the setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

The script:

1. Installs missing software with winget. Software that is already there (its command is on PATH, or winget knows about it) is left alone.
2. Asks whether to install Orca and Claude Code.
3. Asks for `OPENALEX_EMAIL` (recommended), `SEMANTIC_SCHOLAR_API_KEY` and `ELSEVIER_API_KEY`. Press Enter to skip any of them.
4. Runs `node harness\setup\setup.mjs` and prints a `PASS / WARN / FAIL / SKIP` summary.

The first run takes **15–40 minutes**, mostly installing R packages.

| Flag | Effect |
|---|---|
| `-SkipInstall` | Do not install software |
| `-SkipR` | Do not install R packages |
| `-Offline` | Skip the MCP test that needs the network |
| `-NoPrompt` | Ask nothing; use existing environment variables and skip Orca and Claude Code |

**If a line says FAIL:** fix it using §6, **open a new PowerShell window** so PATH updates, and rerun.

### 2.4 Sign in to Claude Code

```powershell
claude
```

Follow the sign-in prompts, then `/exit`. On Windows, Claude Code runs commands and hooks through **Git Bash** (installed with Git). If it cannot find bash, set `CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe`.

### 2.5 Word styles (once)

Open `template\paper\reference.docx` in Word, adjust fonts, headings and table styles, save, and commit:

```powershell
git add template/paper/reference.docx
git commit -m "Set Word styles in reference.docx"
```

## 3. Orca

1. Open Orca. If the setup did not install it, download `orca-windows-setup.exe` from https://github.com/stablyai/orca/releases.
2. **Add repository** and choose `C:\econ` (already done if the `orca` CLI was available).
3. In Orca's agent settings, make **Claude** the default agent.
4. Start an agent in the `econ` workspace and run `/ae-new <slug>`, for example `/ae-new fdi_vn`.
5. **Add repository** again and choose `C:\econ\projects\<slug>`. Each project is its own Git repository and already has `.claude/`.
6. Run every other command (`/ae-lit`, `/ae-plan`, `/ae-data`, `/ae-estimate`, `/ae-write`, `/ae-review`, `/ae-final`, ...) in the **project** workspace.

**Orca worktrees:**

- Work on research projects in the main checkout.
- A new worktree does **not** bring along anything Git ignores or does not track: the `renv` library, `output/`, and large data files you did not commit. Models run in a worktree will be missing data.
- Use worktrees only for changes to `harness/` in the `econ` repository.

**Independent review by another agent (optional):** after `/ae-write`, open a Codex agent in the same project and ask it to "read `.claude/agents/ae-referee.md` and review the paper following that contract". A different model is a more independent referee than the one that wrote the draft.

## 4. Other agents (optional)

| Agent | How it uses the harness |
|---|---|
| **Claude Code** | Everything: `/ae-*` commands, subagents, skills, the raw-data hook, MCP |
| **Codex** | Reads `AGENTS.md`. Setup registers the MCP server if `codex` is installed. There are no `/ae-*` slash commands; ask it to "follow `.claude/commands/ae-lit.md`". **No raw-data hook**, so only the rules in `AGENTS.md` protect `data/raw` |
| **omp** | Run `powershell -ExecutionPolicy Bypass -File harness\install.ps1`. Setup already writes `.omp/config.yml`. Register the MCP server in `%USERPROFILE%\.omp\agent\mcp.json` under `"mcpServers"` |

Example `mcp.json` for omp (keep any other servers):

```json
{
  "mcpServers": {
    "research_discovery": {
      "command": "node",
      "args": ["C:/econ/harness/mcp/research-discovery/dist/index.js"],
      "env": { "OPENALEX_EMAIL": "<email>" }
    }
  }
}
```

## 5. Checklist after installing

`setup.mjs` runs part **A** itself. Do part **B** by hand once.

**A. Automatic** (rerun any time with `node harness\setup\setup.mjs --skip-r`)

- [ ] `node`, `git`, `Rscript`, `quarto` all PASS
- [ ] `MCP build (dist/index.js)` PASS
- [ ] `R packages` PASS (also read the WARN lines for method packages)
- [ ] `register MCP for Claude Code` PASS
- [ ] `raw-guard hook tests` PASS
- [ ] `.claude/ in sync with harness/` PASS
- [ ] `audit-smoke.R` PASS
- [ ] `MCP protocol test` PASS

**B. In Claude Code / Orca** (agent started in `C:\econ`)

- [ ] `/mcp` shows `research_discovery` as connected
- [ ] Typing `/ae-` lists all 13 commands
- [ ] `/agents` lists the 7 `ae-*` agents
- [ ] `/ae-new smoke` creates `projects\smoke` with `.git`, `renv.lock` and `.claude\`
- [ ] In `projects\smoke`, `Rscript render.R` produces `output\paper\manuscript.html`
- [ ] Asking the agent to "write `data/raw/x.csv`" is blocked with an `ae-raw-guard` message
- [ ] Delete `projects\smoke` when done

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `Rscript` is not recognized | Open a new PowerShell window. If it persists, add `C:\Program Files\R\R-4.x.x\bin` to your user PATH |
| `node` or `quarto` is not recognized right after installing | Open a **new** PowerShell window and rerun the script |
| `winget could not install RProject.Rtools` | Download Rtools46 from https://cran.r-project.org/bin/windows/Rtools/ and tick "Add to PATH" |
| Method packages (`fwildclusterboot`, `HonestDiD`, `contdid`, ...) show WARN | Install Rtools, open a new PowerShell window, run `Rscript harness\setup\install-packages.R` |
| `MCP protocol test` FAIL | Check the network or proxy, set `OPENALEX_EMAIL`, and rerun `node scripts\protocol-test.mjs` in `harness\mcp\research-discovery` |
| `/mcp` does not show `research_discovery` | Run `claude mcp list`; if it is missing, rerun `node harness\setup\setup.mjs --skip-r` |
| The hook does not block writes to `data/raw` | Check that `.claude\settings.json` has `PreToolUse`, run `node harness\tests\raw-guard.test.mjs`, and make sure Claude Code finds Git Bash (§2.4) |
| `/ae-*` commands missing in an older project | Run `node harness\scripts\sync-agents.mjs --projects` in `C:\econ` |
| `renv::init` fails during `/ae-new` | Usually spaces in the path, OneDrive, or missing Rtools; move the repository to `C:\econ` |
| CRLF line endings clutter diffs | `.gitattributes` enforces LF; for an older clone run `git add --renormalize .` |

## 7. Updating the harness

1. Edit the **sources** in `harness/` (commands, agents, skills, `harness/claude/`). Never edit `.claude/`.
2. Run `node harness/scripts/sync-agents.mjs` (add `--projects` to update existing projects).
3. Check:
   ```powershell
   node harness\tests\raw-guard.test.mjs
   node harness\scripts\sync-agents.mjs --check
   Rscript harness\tests\audit-smoke.R
   ```
4. Commit and push. On other machines run `git pull`, then `node harness\setup\setup.mjs --skip-r` if the MCP server changed.

## 8. ClaudeR (optional: let the agent work inside RStudio)

Only needed if you want the agent to run code, view plots or inspect objects **in your open RStudio session**.

1. Install `uv`:
   ```powershell
   winget install --id astral-sh.uv -e
   ```
2. Install ClaudeR in RStudio:
   ```r
   install.packages("remotes")
   remotes::install_github("IMNMV/ClaudeR")
   ```
3. Connect it to Claude Code following the README of `IMNMV/ClaudeR`. The setup command changes between versions, so check the README first.
4. To work in RStudio yourself again, click **Stop Server** in the add-in, or remove it with `claude mcp remove <name>`. You cannot use the session by hand while the add-in is running.
