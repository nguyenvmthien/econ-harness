---
name: ae-data
description: Use when registering raw data, constructing analysis data, auditing merges, or documenting sample restrictions.
---
# Data foundation
When the main agent runs `/ae-data` on unfamiliar or raw data, it dispatches the read-only `ae-data-auditor` to map source files, observation grain, variable-role candidates, integrity risks, and model-data prerequisites. The auditor itself never delegates. Treat its output as a preliminary audit: the main agent owns decisions and all project-file changes; a variable name or panel shape alone never validates a construct or identification strategy.

Register every immutable source with `ae_register_raw`; verify checksums before building. Parse UTF-8 and locale-specific numbers explicitly (e.g., `1.234,5`). Record consolidated versus standalone financial statements, annual/quarterly alignment, mergers/ticker changes, and crosswalks. Assert unique keys before joins; state expected join relationship and report matched/unmatched records on both sides. Test panel balance; report missingness by variable and document decisions; do not impute outcome/treatment by default. Address outliers and denominator-near-zero rules in PLAN before estimation. Check disclosure timing/look-ahead, survivorship, CPI deflation, and `log1p` choices. Codebook must define all seven fields. Preserve sample flow and each restriction.
