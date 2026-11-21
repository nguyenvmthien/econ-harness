---
name: ae-new
description: "Create a clean applied-economics project from the econ template"
---
<!-- GENERATED from harness/commands/ae-new.md by harness/scripts/sync-agents.mjs — edit the source, not this file. -->

# Workflow

Treat the text following `$ae-new` as `$ARGUMENTS` in the workflow below.

If this workflow asks you to dispatch or call an `ae-*` specialist, spawn a generic subagent and instruct it to use the matching `$ae-*` skill. If multi-agent tools are unavailable, follow that specialist contract inline.

Validate `$ARGUMENTS` against `^[a-z0-9_][a-z0-9_-]*$`; stop if `projects/<slug>` exists. Copy `template/` to `projects/<slug>`, rename `template.Rproj`, substitute `{{SLUG}}` and `{{DATE}}` in controls/manuscript, initialize a project Git repository and commit `init <slug>`, then run `Rscript -e "renv::init(restart = FALSE)"` in the project. On renv failure stop and report the exact error. End by recording the next step and dated log entry; suggest opening the Rproj and running `$ae-lit` or `$ae-plan`.
