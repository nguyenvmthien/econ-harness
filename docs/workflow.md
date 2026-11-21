# Workflow

This guide explains the steps the README only lists. The binding rules for agents are in `AGENTS.md`; where the two differ, `AGENTS.md` wins.

## Workspace and projects

- Use `/ae-*` with Claude Code and the equivalent `$ae-*` skill with Codex. For example, `/ae-new <slug>` and `$ae-new <slug>` run at the workspace root and create `projects/<slug>` from `template/`.
- Every other workflow runs **inside the project**: in Orca, add `projects/<slug>` as its own repository, or `cd projects/<slug>` and run `claude` or `codex`.
- Each project carries its own `.claude/`, `.agents/skills/` and `.codex/`. After updating the harness, run `node harness/scripts/sync-agents.mjs --projects` at the root to refresh existing projects.
- The same PreToolUse hook blocks writes to `data/raw` in both agents (Claude: `.claude/settings.json`; Codex: `.codex/hooks.json`, which covers `apply_patch` and shell commands). Codex loads it only after you trust the folder and approve the hook; open Codex at the project root so the hook path resolves.
- Each project is its own Git repository, so Codex does not load the workspace `AGENTS.md` automatically; the project's `AGENTS.md` tells it to read `../../AGENTS.md` first.
- Codex runs shell commands in its sandbox without network access by default. Steps that download (`renv::init()`, R package installs, `R/00_download.R`, DOI lookups via `curl`) will ask for approval to run outside the sandbox; approve them, or start Codex with network access enabled. The `research_discovery` MCP server is not affected.

## Steps

### Literature: `/ae-lit` or `$ae-lit`, `/ae-cite` or `$ae-cite`

`/ae-lit` uses the `research_discovery` MCP server to find and read papers and records evidence in `literature/EVIDENCE.csv`.

References enter `paper/references.bib` only through `/ae-cite <DOI>`. The check status of each citation is kept in `literature/citation_checks.csv`; during `/ae-review` the `ae-citation-check` subagent independently rechecks every cited sentence in the manuscript.

### Design: `/ae-plan` or `$ae-plan`, `/ae-exogenous` or `$ae-exogenous`

`/ae-plan` writes `PLAN.md`: question, hypotheses, data and model specifications. Results produced **before** the matching PLAN §9 row was written are labelled EXPLORATORY and cannot support a causal conclusion.

`/ae-exogenous [question]` looks for exogenous variation before a design is chosen:

- defines the estimand and searches for up to three documented assignment mechanisms;
- checks policy and event details against primary sources;
- stress-tests the assumptions of IV, DiD, continuous-exposure DiD and RDD.

It does not run regressions, rank candidates by p-value, or change data, PLAN or the manuscript. Reports are saved in `output/logs/exogenous/`.

### Data and estimation: `/ae-data` or `$ae-data`, `/ae-estimate` or `$ae-estimate`, `/ae-consolidate` or `$ae-consolidate`

- Raw data reaches `data/raw` through `R/00_download.R` or files the user drops in, and is registered with `ae_register_raw()`. Agents never edit raw files; cleaning always happens in code.
- `R/01_build.R` builds `data/analysis.rds`; variable definitions live in `data/codebook.csv`.
- Estimation code is free-form and can run in any order. Always set `vcov` explicitly in `feols`.
- `Rscript run_all.R` reruns the whole pipeline in script order.

| Script | Produces |
|---|---|
| `R/01_build.R` | `data/analysis.rds` |
| `R/02_describe.R` | descriptive statistics |
| `R/03_main.R` | main models |
| `R/04_robustness.R` | robustness checks |
| `R/05_extensions.R` | extensions |
| `R/99_audit.R` | `output/logs/audit.md` (full) or `audit_manuscript.md` (manuscript only) |

### Exploration: `/ae-phacking` or `$ae-phacking`, `/ae-hark` or `$ae-hark`

These two commands are for finding research directions. Everything they produce is **EXPLORATORY**.

`/ae-phacking [path/scope/grid]` searches broadly over any readable data, without `/ae-data`, PLAN or a codebook:

- tries Y/X pairs, controls, proxies, candidate 2SLS IV triples, fixed effects, inference choices, transforms and subsamples;
- separately lists potential sources of variation (policies, shocks, thresholds), keeping observed evidence apart from assumptions;
- keeps the full grid, including failed runs and null results. There is no cap on the number of tests.

Variation is never called exogenous until independently verified, and a strong first stage does not make an instrument valid.

`/ae-hark [ID...]` runs the actual models and robustness checks, compares sign, magnitude, SE/CI, samples and diagnostics, and writes an evidence matrix to `output/logs/hypothesis_reframe.md`. Revised hypotheses are added to PLAN §9a with `origin=post-results`; the original hypotheses and contrary results stay. Stability within one sample is neither an independent test nor causal evidence.

### Writing and review: `/ae-write` or `$ae-write`, `/ae-review` or `$ae-review`, `/ae-final` or `$ae-final`

- `/ae-write <section>` drafts a manuscript section in English and renders HTML for review.
- `/ae-review` reruns the full pipeline and the full audit, and asks the `ae-referee` subagent for a referee report.
- `/ae-final [style]` checks the audit and citations, and produces DOCX only after the user has reviewed the HTML.

## Results tables

Tables are always built in R from fitted model objects with `modelsummary`, `datasummary` or `fixest::etable`. Never copy coefficients to a CSV and rebuild a table by hand.

```r
ae_export_table(list("(1)" = m1, "(2)" = m2), "T2_baseline")
```

This writes three files to `output/tables/`:

- `T2_baseline.html`: view it in the RStudio Viewer (it opens automatically inside RStudio);
- `T2_baseline.md`: Markdown version;
- `T2_baseline.rds`: inserted into the manuscript.

The SE type and number of clusters are read from the model object. Reopen a table with `ae_view_table("T2_baseline")`. To send a single table as Word, add `docx = TRUE`.

## Rendering the manuscript

The manuscript is `paper/manuscript.qmd`; tables are inserted with `ae_table("T2_baseline")`.

**Always check the HTML first.** DOCX is produced only at the final step.

| Command | Effect |
|---|---|
| `Rscript render.R` | Render HTML and open it in the Viewer |
| `Rscript render.R docx` | Render HTML, then the final DOCX |
| `Rscript render.R html run` | Rerun every model before rendering |

In RStudio: open `render.R`, set `DOCX` or `RUN_MODELS` at the top, then Source it (Ctrl+Shift+S). RStudio's Render button also produces HTML but skips the missing-table check; `render.R` stops if the manuscript calls a table that has not been exported.

Word styles live in `paper/reference.docx`; adjust them once in Word.

## Project folders

| Folder | Contents |
|---|---|
| `data/raw` | Source data, never modified |
| `data/analysis.rds`, `data/codebook.csv` | Analysis dataset and variable definitions |
| `R/` | Scripts, run in order |
| `output/` | Tables, figures, models, logs |
| `paper/` | Manuscript |
| `literature/` | Evidence and citation checks |
| `scratch/` | Experiments |

Method guides (OLS/panel, IV, DiD, GMM, inference) are in `harness/skills/ae-methods/references/`.
