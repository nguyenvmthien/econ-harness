---
name: ae-review
description: Use to referee an empirical economics project or assess submission readiness without making edits.
---
# Referee checklist
Assess (1) estimand/design and identifying assumptions; (2) estimators, inference, diagnostics; (3) data construction, sample, missingness; (4) PLAN §9 coverage; (5) prose versus verdict; (6) numerical and citation traceability. Separate machine audit from judgment. Report FATAL/MAJOR/MINOR findings with evidence, location, consequence, actionable remedy, then recommendation: reject/major/minor/accept. Do not alter files or overstate what diagnostics establish.

Nếu có `output/logs/hypothesis_reframe.md`, đối chiếu ma trận mô hình và chẩn đoán với giả thuyết hậu nghiệm trong PLAN/QMD: ổn định về dấu, độ lớn, suy luận và mẫu? Kết quả trái chiều đã được ghi? Trình bày là khám phá thay vì đã đăng ký trước? Chỉ phê bình sai lệch cụ thể; HARKing được công bố minh bạch không tự động là lỗi.

<!-- Command workflow merged from harness/commands/ae-review.md by harness/scripts/sync-agents.mjs. -->

## Codex workflow entry point

Treat the text following `$ae-review` as `$ARGUMENTS` in the workflow below.

If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.

Read PLAN and LOG. Read the final `paper/manuscript.qmd` and enumerate every current `(citekey, complete sentence including marker, paper/manuscript.qmd:<starting line>)` pair, excluding `@tbl-`, `@fig-`, `@eq-`, `@sec-`. Dispatch `ae-citation-check` over all pairs in batches of at most ten; one agent per batch, one parallel batch. Check every current pair even if cached; retain metadata-only rows (empty `location` and `claim`) and replace all claim rows with the newly evidenced results. Agents read only `paper/` and `literature/`. While they run, execute `Rscript run_all.R`, then `Rscript R/99_audit.R` (full reproduction audit), then call `ae-referee`. Save dated `review/*-review.md` with audit and reviewer findings. Update Next and LOG.
Review hypothesis provenance and strength: compare original and revised PLAN §9a rows, §12 deviations, `output/logs/hypothesis_reframe.md` (if present), fitted models and manuscript wording. Recheck whether a claimed stable result survives defensible changes in controls/FE, sample, measurement and SE, and whether null/contrary results are reported. Retrospective hypotheses are allowed; require clear `post-results/exploratory` language and reject claims of ex-ante registration or independent confirmation from the same data. Distinguish a stable association from credible causal identification. Include concrete discrepancies in the dated review; do not rewrite original locked hypotheses.
If a hypothesis or model was selected through `$ae-phacking`, read the exact `output/logs/phacking/<run-id>.md` named in LOG/PLAN and its result RDS/script. Compare the claimed direction with the complete attempted grid, including null, failed and `added-after-results` cells. A scratch search is not reproduced by `run_all.R`; require consolidated selected models to be reproduced there before claiming the manuscript results passed full reproduction. Report search breadth and post-selection inference limits in the review.
Require the linked `<run-id>.grid.csv` and check candidate IDs plus all source/specification fields (`source_path`, `source_object`, `outcome`, `outcome_role`, `exposure`, `exposure_role`, `term`, `proxy_target`, `endogenous_regressor`, `instrument`, `estimator`, `controls`, `fe`, `transform`, `subgroup`, `timing`, `sample_rule`, `se_method`, `clusters`, `declaration_timing`, `variation_type`, `variation_source`, `assignment_rule`, `treated_exposure`, `comparison_group`, `estimand`, `identifying_assumption`, `validation_needed`, `diagnostics`) across grid, RDS and report. Flag unverified leads presented as established variation and `not-run` as incomplete coverage.
