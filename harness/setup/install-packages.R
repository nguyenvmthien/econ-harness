# Install the R packages the econ harness needs (run from the workspace root):
#   Rscript harness/setup/install-packages.R          # core + methods
#   Rscript harness/setup/install-packages.R core     # core only
# Core packages are required (audit, tables, render); a failure exits 1.
# Method packages back the ae-methods playbooks; failures are reported but do not stop setup.
# Pinned versions from the spec: contdid 0.1.1, ivDiag 1.0.6, fwildclusterboot 0.14.3.

args <- commandArgs(trailingOnly = TRUE)
only_core <- "core" %in% args

options(
  repos = c(
    CRAN = "https://cloud.r-project.org",
    # fwildclusterboot and HonestDiD are distributed via r-universe (binaries for Windows/macOS).
    s3alfisc = "https://s3alfisc.r-universe.dev",
    asheshrambachan = "https://asheshrambachan.r-universe.dev"
  ),
  install.packages.check.source = "no"
)
if (.Platform$OS.type == "windows") options(pkgType = "binary")

core <- c(
  "renv", "here", "readr", "readxl", "dplyr", "tidyr", "tibble", "broom", "generics",
  "fixest", "modelsummary", "tinytable", "sandwich", "lmtest", "flextable", "officer",
  "ggplot2", "knitr", "rmarkdown", "quarto", "rstudioapi", "dqrng", "pkgbuild"
)
methods <- c(
  "plm", "AER", "car", "clubSandwich", "sensemakr", "did", "didimputation", "bacondecomp",
  "HonestDiD", "contdid", "ivDiag", "fwildclusterboot"
)
pinned <- c(contdid = "0.1.1", ivDiag = "1.0.6", fwildclusterboot = "0.14.3")

have <- function(p) requireNamespace(p, quietly = TRUE)

install_set <- function(pkgs) {
  missing <- pkgs[!vapply(pkgs, have, logical(1))]
  if (length(missing)) {
    message("Installing: ", paste(missing, collapse = ", "))
    tryCatch(install.packages(missing, dependencies = c("Depends", "Imports", "LinkingTo")),
             error = function(e) message("install.packages error: ", conditionMessage(e)))
  }
  pkgs[!vapply(pkgs, have, logical(1))]
}

failed_core <- install_set(core)
failed_methods <- if (only_core) character() else install_set(methods)

cat("\n== R package report ==\n")
cat("R version:", R.version.string, "\n")
for (p in c(core, if (!only_core) methods)) {
  v <- if (have(p)) as.character(utils::packageVersion(p)) else "MISSING"
  note <- if (p %in% names(pinned) && v != "MISSING" && v != pinned[[p]]) paste0("  (spec: ", pinned[[p]], ")") else ""
  cat(sprintf("  %-18s %s%s\n", p, v, note))
}
if (.Platform$OS.type == "windows" && have("pkgbuild")) {
  cat("Rtools available:", isTRUE(pkgbuild::has_build_tools(debug = FALSE)), "\n")
}
if (length(failed_methods)) {
  cat("\nWARNING: method packages not installed:", paste(failed_methods, collapse = ", "),
      "\n  The related ae-methods playbooks will fail until they are installed (install Rtools, then rerun).\n")
}
if (length(failed_core)) {
  cat("\nERROR: core packages missing:", paste(failed_core, collapse = ", "), "\n")
  quit(status = 1)
}
cat("\nCore packages OK.\n")
