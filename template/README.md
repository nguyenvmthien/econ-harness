# {{SLUG}}

## Data and reproducibility
Raw sources and checksums are recorded in `data/RAW_MANIFEST.csv`. The analysis dataset is `data/analysis.rds`; variable definitions are in `data/codebook.csv`.

## Research loop
Fast iteration: `/ae-estimate <ID>` selects planned analyses, then `/ae-write <section>` or `Rscript render.R` runs the manuscript-only audit and renders HTML. Before PLAN §9 is locked, results are **EXPLORATORY**. Reproducibility milestone: `/ae-review` runs the full pipeline and full audit; `/ae-final` checks the full audit and citation status, then produces DOCX only after the user reviews HTML in the Viewer. The manuscript-only audit does not replace full reproduction.

For results-first hypothesis development use `/ae-hark [ID...]`: run the relevant models and robustness scripts, compare sign, magnitude, SE/CI, sample changes and diagnostics, then record a stable/mixed/fragile evidence matrix in `output/logs/hypothesis_reframe.md`. Append revised hypotheses as `origin=post-results` to PLAN §9a and note deviations in §12 without erasing original hypotheses. The manuscript describes these as retrospective/exploratory; same-sample stability is not independent confirmation or a causal design.
`/ae-phacking [path/scope/grid]` is an independent scratch search; `/ae-data`, PLAN, codebook and quality PASS are not prerequisites. Explicit files/directories take precedence; otherwise use readable `data/analysis.rds`, then discover tables under `data/` (including read-only `data/raw/`). The broad grid covers Y/X pairs, controls, labeled/designated proxies, candidate 2SLS IV triples, FE, supported inference, transforms and subsamples; it separately inventories potential policy/shock/threshold/assignment variation, distinguishing observed evidence from assumptions and missing external validation. Never label unverified variation exogenous or causal; IV relevance does not establish exclusion or validity. Preserve inputs, save every attempt, and reconcile role/proxy/IV/variation fields before optional `/ae-hark` or `/ae-consolidate`.

`/ae-exogenous [question/context]` is a separate design-discovery step before estimation: it defines the estimand, searches up to three evidence-backed assignment mechanisms, verifies policy/event details against primary sources, and stress-tests IV/DiD/continuous-exposure DiD/RDD assumptions. It does not run regressions or rank candidates by p-value; source facts, assumptions, threats and missing data are reported separately. PLAN, LOG and data-quality PASS are not prerequisites. The dated report is saved under `output/logs/exogenous/` without changing data, PLAN or manuscript.

Run `Rscript run_all.R` from this project to rebuild analysis and models in script order. Render with `Rscript render.R` (HTML) or `Rscript render.R docx` (HTML first, then final DOCX); in RStudio, open `render.R` and Source it. Dependencies are recorded in `renv.lock` after `/ae-new`.

## Script → output
`R/01_build.R` → analysis.rds; `R/02_describe.R` → descriptive objects; `R/03_main.R` → main models; `R/04_robustness.R` → robustness; `R/05_extensions.R` → extensions; `R/99_audit.R` → full `audit.md` or manuscript-only `audit_manuscript.md`.
