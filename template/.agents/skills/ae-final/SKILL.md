---
name: ae-final
description: "Produce the final DOCX manuscript"
---
<!-- GENERATED from harness/commands/ae-final.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->

# Workflow

Treat the text following `$ae-final` as `$ARGUMENTS` in the workflow below.

If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.

Read PLAN.md and LOG.md. Run `Rscript R/99_audit.R` (full audit); stop on FAIL. Compare every current claim citation pair in `paper/manuscript.qmd` (citekey + full sentence + starting line; exclude table/figure/equation/section cross-references) with `literature/citation_checks.csv`. Stop DOCX if any current claim is `NOT-SUPPORTED` or the manuscript contains `[CITATION NEEDED]`. Report `CANNOT-VERIFY` and unchecked/missing claim rows explicitly; neither means verified, but neither alone blocks DOCX. Keep metadata-only rows distinct from claim verification. If `$ARGUMENTS` gives a CSL style id, download https://www.zotero.org/styles/<id> to `paper/<id>.csl` and set `csl:` in manuscript YAML.

Before DOCX, compare original and revised §9a hypotheses, §12 deviations, any `output/logs/hypothesis_reframe.md` and the manuscript. Post-results hypotheses may appear when labelled retrospective/exploratory and tied to actually run, sufficiently consistent models; report null or conflicting checks and limitations. Do not present them as pre-specified, independently confirmed from the same sample, or causal beyond PLAN §11. If provenance or the stated robustness is contradicted by model outputs, correct the wording before DOCX; do not erase an original locked hypothesis.
If a manuscript claim originated from `$ae-phacking`, inspect the linked search report and the corresponding `$ae-hark` evidence matrix before DOCX. Keep the selection history and exploratory status visible; never treat the smallest searched p-value as an independent test or count a scratch-only result as full-pipeline reproduction.
For that search provenance gate, require the linked `<run-id>.grid.csv` and reconcile every cited candidate ID and all source/specification fields (`source_path`, `source_object`, `outcome`, `outcome_role`, `exposure`, `exposure_role`, `term`, `proxy_target`, `endogenous_regressor`, `instrument`, `estimator`, `controls`, `fe`, `transform`, `subgroup`, `timing`, `sample_rule`, `se_method`, `clusters`, `declaration_timing`, `variation_type`, `variation_source`, `assignment_rule`, `treated_exposure`, `comparison_group`, `estimand`, `identifying_assumption`, `validation_needed`, `diagnostics`) against RDS and report. Treat design-only variation as unverified, and disclose `not-run` coverage. Never promote mismatched IDs or unverified assumptions into claims.

Only after the user reviewed HTML in the RStudio Viewer, run `Rscript render.R docx` (HTML first, DOCX second). Check output/paper/manuscript.docx: `Table N:` captions count equals `#| label: tbl-` chunks and `Figure N:` captions equals `#| label: fig-` chunks (Quarto wraps figures in layout tables; do not compare raw `w:tbl` counts); `officer::docx_summary()` has no paragraph with style `Source Code`. Update LOG with audit, citation gate, HARKing/provenance gate, Viewer approval, and output checks.
