---
description: Register raw sources and construct and audit the canonical analysis dataset
---
Read `PLAN.md` and `LOG.md`; follow the `ae-data` skill. List unregistered files under `data/raw/` and check source provenance in `data/RAW_MANIFEST.csv`. Ask the user only for missing source/URL details; register confirmed sources through `ae_register_raw`.

Before editing the codebook or running any data-building script, dispatch one read-only `ae-data-auditor` with the project root, `PLAN.md`, `LOG.md`, raw manifest, codebook, raw files, existing `data/analysis.rds` schema if present, and data-preparation scripts. Use its findings as a preliminary map, not as verified identification or approval to transform or exclude observations. Resolve provenance and construct-validity blockers with the user; the user decides sample restrictions.

Then update the codebook and `R/01_build.R`; use explicit merge keys/relationships and report matched/unmatched counts, missingness and sample flow. Run `Rscript R/01_build.R` and `Rscript R/02_describe.R`. Write `output/logs/data_quality_report.md` with the auditor's preliminary findings, executed data-integrity/descriptive diagnostics, unresolved caveats, and a final gate verdict: `PASS`, `PASS WITH CAVEATS`, or `FAIL`. Do not proceed to model estimation if the verdict is `FAIL`. Show diagnostics and proposed sample restrictions; user decides exclusions. Update Next and LOG.
