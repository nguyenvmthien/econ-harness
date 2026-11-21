# {{SLUG}}

## Reproduce

```bash
Rscript run_all.R            # rebuild data/analysis.rds and every model, in script order
Rscript render.R             # render the manuscript to HTML
Rscript render.R docx        # HTML, then the final DOCX
```

In RStudio, open `render.R` and Source it. Package versions are pinned in `renv.lock`.

## Data

- Raw sources and their checksums: `data/RAW_MANIFEST.csv`. Files in `data/raw/` are never edited.
- Analysis dataset: `data/analysis.rds`.
- Variable definitions: `data/codebook.csv`.

## Scripts

| Script | Produces |
|---|---|
| `R/01_build.R` | `data/analysis.rds` |
| `R/02_describe.R` | descriptive statistics |
| `R/03_main.R` | main models |
| `R/04_robustness.R` | robustness checks |
| `R/05_extensions.R` | extensions |
| `R/99_audit.R` | `output/logs/audit.md` (full) or `audit_manuscript.md` (manuscript only) |

## Status of results

Results produced before the matching row of PLAN §9 was written are **exploratory**. So are results from `/ae-phacking` and hypotheses revised with `/ae-hark` (marked `origin=post-results` in PLAN §9a). Neither is evidence of a causal effect.

`/ae-review` reruns the full pipeline and audit; the manuscript-only audit run by `render.R` does not replace it.
