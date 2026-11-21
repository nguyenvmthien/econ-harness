---
name: ae-consolidate
description: "Consolidate exploratory analyses into reproducible planned scripts"
---
<!-- GENERATED from harness/commands/ae-consolidate.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->

# Workflow

Treat the text following `$ae-consolidate` as `$ARGUMENTS` in the workflow below.

If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.

Read PLAN and LOG. Inventory scripts in `$ARGUMENTS` (default `scratch/`), their inputs, outputs, and models. Map results to existing PLAN IDs only when the hypotheses and specifications were locked before outcome results were inspected; otherwise retain **EXPLORATORY** status and log the post-hoc origin in §12. Ask about ambiguity. Save before summaries of kept models, refactor into R/01–05 using `ae-r-code`, rerun pipeline, and compare estimate, SE, and N at relative tolerance 1e-8. Explain every discrepancy. A hypothesis generated from exploratory results can be tested confirmatorily only in a new independent sample or an untouched holdout defined before its outcomes are inspected; never rewrite old results or backdate the plan. Move legacy scripts only after commit. Update Next and LOG.

If the goal is to reframe hypotheses after exploratory modeling, pass the complete inventory of kept and conflicting model outputs to `$ae-hark` after reproducibility checks; do not turn the strongest exploratory result into a supposedly pre-specified hypothesis.
If a script came from `$ae-phacking`, read its linked `output/logs/phacking/<run-id>.md` and result RDS, preserve the complete search record outside the production pipeline, and reconcile selected estimates with the original scratch run. Consolidation makes the selected script reproducible; it does not turn a search-selected hypothesis or p-value into a precommitted test.
For `$ae-phacking` runs, require the linked `<run-id>.grid.csv` and verify every selected candidate ID and all source/specification fields (`source_path`, `source_object`, `outcome`, `outcome_role`, `exposure`, `exposure_role`, `term`, `proxy_target`, `endogenous_regressor`, `instrument`, `estimator`, `controls`, `fe`, `transform`, `subgroup`, `timing`, `sample_rule`, `se_method`, `clusters`, `declaration_timing`, `variation_type`, `variation_source`, `assignment_rule`, `treated_exposure`, `comparison_group`, `estimand`, `identifying_assumption`, `validation_needed`, `diagnostics`) across grid, result RDS and report before moving its script. Keep design-only/unverified leads distinct from model results; `not-run` means incomplete coverage.
