---
name: ae-cite
description: "Add DOI-verified references using canonical bibliographic metadata"
---
<!-- GENERATED from harness/commands/ae-cite.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->

# Workflow

Treat the text following `$ae-cite` as `$ARGUMENTS` in the workflow below.

If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.

Read `PLAN.md` and `LOG.md`. For each DOI in `$ARGUMENTS`, skip existing DOI; call `get_bibtex`, and if resolution fails report exactly `DOI không resolve: <doi>` and do not modify `paper/references.bib` for that DOI. For each resolved DOI, generate the canonical citekey from title/author/year, append the returned BibTeX unchanged to `paper/references.bib`, compare metadata with `paper_get`, then run `verify_references`. Record metadata/CrossRef outcome in `literature/citation_checks.csv`; flag mismatches without silently fixing metadata. Add exactly one metadata-only row per DOI with `location` and `claim` empty; metadata checks do not validate a manuscript claim. Preserve all nine columns. Update Next and dated LOG entry.
