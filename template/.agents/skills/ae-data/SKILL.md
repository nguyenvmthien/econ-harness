---
name: ae-data
description: Use when registering raw data, constructing analysis data, auditing merges, or documenting sample restrictions.
---
# Data foundation
When the main agent runs `$ae-data` on unfamiliar or raw data, it dispatches the read-only `ae-data-auditor` to map source files, observation grain, variable-role candidates, integrity risks, and model-data prerequisites. The auditor itself never delegates. Treat its output as a preliminary audit: the main agent owns decisions and all project-file changes; a variable name or panel shape alone never validates a construct or identification strategy.

Register every immutable source with `ae_register_raw`; verify checksums before building. Parse UTF-8 and locale-specific numbers explicitly (e.g., `1.234,5`). Record consolidated versus standalone financial statements, annual/quarterly alignment, mergers/ticker changes, and crosswalks. Assert unique keys before joins; state expected join relationship and report matched/unmatched records on both sides. Test panel balance; report missingness by variable and document decisions; do not impute outcome/treatment by default. Address outliers and denominator-near-zero rules in PLAN before estimation. Check disclosure timing/look-ahead, survivorship, CPI deflation, and `log1p` choices. Codebook must define all seven fields. Preserve sample flow and each restriction.

<!-- Command workflow merged from harness/commands/ae-data.md by harness/scripts/sync-agents.mjs. -->

## Codex workflow entry point

Treat the text following `$ae-data` as `$ARGUMENTS` in the workflow below.

If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.

Read `PLAN.md` and `LOG.md`; follow the `ae-data` skill. List unregistered files under `data/raw/` and check source provenance in `data/RAW_MANIFEST.csv`. Ask the user only for missing source/URL details; register confirmed sources through `ae_register_raw`.

Before editing the codebook or running any data-building script, dispatch one read-only `ae-data-auditor` with the project root, `PLAN.md`, `LOG.md`, raw manifest, codebook, raw files, existing `data/analysis.rds` schema if present, and data-preparation scripts. Use its findings as a preliminary map, not as verified identification or approval to transform or exclude observations. Resolve provenance and construct-validity blockers with the user; the user decides sample restrictions.

Then update the codebook and `R/01_build.R`; use explicit merge keys/relationships and report matched/unmatched counts, missingness and sample flow. Run `Rscript R/01_build.R` and `Rscript R/02_describe.R`. Write `output/logs/data_quality_report.md` with the auditor's preliminary findings, executed data-integrity/descriptive diagnostics, unresolved caveats, and a final gate verdict: `PASS`, `PASS WITH CAVEATS`, or `FAIL`. Do not proceed to model estimation if the verdict is `FAIL`. Show diagnostics and proposed sample restrictions; user decides exclusions. Update Next and LOG.
