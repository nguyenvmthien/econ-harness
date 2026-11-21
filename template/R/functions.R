# ==== functions.R ====================================================
# Helpers shared by all scripts. Tables are built by modelsummary from fitted
# model objects and exported as finished files (HTML + MD + RDS)
# inside the R script that estimates them. The manuscript only displays them.
# ====================================================================

# ---- Raw data provenance -------------------------------------------
ae_register_raw <- function(file, source, url = NA, note = NA) {
  path <- here::here("data/raw", file)
  if (!file.exists(path)) stop("Raw file does not exist: ", path)
  manifest <- here::here("data/RAW_MANIFEST.csv")
  x <- readr::read_csv(manifest, col_types = readr::cols(.default = readr::col_character(), bytes = readr::col_double()))
  if (file %in% x$file) stop("Raw file already registered: ", file)
  row <- tibble::tibble(file = file, source = source, url = as.character(url), date_added = as.character(Sys.Date()),
                        md5 = unname(tools::md5sum(path)), bytes = file.info(path)$size, note = as.character(note))
  readr::write_csv(dplyr::bind_rows(x, row), manifest)
  invisible(row)
}

ae_check_raw <- function() {
  m <- readr::read_csv(here::here("data/RAW_MANIFEST.csv"), col_types = readr::cols(.default = readr::col_character()))
  files <- list.files(here::here("data/raw"), recursive = TRUE)
  files <- files[!grepl("(^|/)\\.gitkeep$", files)]
  absent <- m$file[!file.exists(here::here("data/raw", m$file))]
  if (length(absent)) stop("Registered raw file missing: ", paste(absent, collapse = ", "))
  changed <- m$file[unname(tools::md5sum(here::here("data/raw", m$file))) != m$md5]
  if (length(changed)) stop("Raw checksum mismatch: ", paste(changed, collapse = ", "))
  extra <- setdiff(files, m$file)
  if (length(extra)) stop("Unregistered raw file: ", paste(extra, collapse = ", "))
  invisible(TRUE)
}

# ---- Analysis data --------------------------------------------------
ae_labels <- function() {
  x <- readr::read_csv(here::here("data/codebook.csv"), show_col_types = FALSE)
  stats::setNames(x$label, x$variable)
}

ae_save_analysis <- function(df) {
  vars <- readr::read_csv(here::here("data/codebook.csv"), show_col_types = FALSE)$variable
  undocumented <- setdiff(names(df), vars)
  if (length(undocumented)) stop("Columns missing from data/codebook.csv: ", paste(undocumented, collapse = ", "))
  saveRDS(df, here::here("data/analysis.rds"))
  dir.create(here::here("output/logs"), showWarnings = FALSE, recursive = TRUE)
  writeLines(c(paste("md5", unname(tools::md5sum(here::here("data/analysis.rds")))), paste("nrow", nrow(df)),
               paste("ncol", ncol(df)), paste("time", Sys.time())), here::here("output/logs/analysis_md5.txt"))
}

ae_flow <- function(flow = NULL, step, df, unit) {
  dplyr::bind_rows(flow, tibble::tibble(step = step, n_obs = nrow(df), n_units = dplyr::n_distinct(df[[unit]])))
}

# ---- Inline numbers --------------------------------------------------
# Number for manuscript prose, read from a fitted model object, e.g. in the QMD:
#   main <- readRDS(here::here("output/models/main.rds"))
#   `r ae_coef(main$twfe, "post")`        stat = "estimate", "std.error", "p.value", "conf.low", ...
ae_coef <- function(model, term, stat = "estimate", digits = 3) {
  x <- modelsummary::get_estimates(model)
  if (!term %in% x$term) stop("Term absent: ", term, ". Available: ", paste(x$term, collapse = ", "))
  formatC(x[[stat]][match(term, x$term)], format = "f", digits = digits, big.mark = ",")
}

# ---- modelsummary support for estimators without full broom methods --
# did::AGGTEobj has tidy() but no p-value or glance(); contdid::dose_obj has neither.
# p-values use the normal approximation at full precision (same basis as the packages' pointwise CIs).
.ae_p <- function(est, se) 2 * stats::pnorm(-abs(est / se))

tidy_custom.AGGTEobj <- function(x, ...) {
  out <- generics::tidy(x)
  data.frame(term = out$term, p.value = .ae_p(out$estimate, out$std.error))
}
# did's own glance() reports nobs = number of units; restate as unit-periods so it matches fixest columns.
glance_custom.AGGTEobj <- function(x, ...) {
  p <- x$DIDparams
  out <- data.frame(nobs = p$id_count * p$time_periods_count, n_units = p$id_count)
  if (length(p$clustervars)) {
    out$vcov.type <- sprintf("Clustered (%s)", paste(p$clustervars, collapse = ", "))
    out$n_clusters <- length(unique(p$cluster_vector))
  }
  out
}
# fixest stores the declared VCOV label and cluster count on the estimated covariance matrix.
glance_custom.fixest <- function(x, ...) {
  v <- x$cov.scaled
  out <- data.frame(vcov.type = attr(v, "vcov_type"))
  if (!is.null(attr(v, "G"))) out$n_clusters <- min(attr(v, "G"))
  out
}
tidy.dose_obj <- function(x, ...) {
  est <- c(x$overall_att, x$overall_acrt); se <- c(x$overall_att_se, x$overall_acrt_se)
  data.frame(term = c("ATT (overall)", "ACRT (overall)"), estimate = est, std.error = se,
             statistic = est / se, p.value = .ae_p(est, se), conf.low = est - 1.96 * se, conf.high = est + 1.96 * se)
}
glance.dose_obj <- function(x, ...) {
  p <- x$pte_params
  data.frame(n_units = length(unique(p$data[[p$idname]])),
             vcov.type = if (isTRUE(p$bstrap)) "Multiplier bootstrap" else "Analytical")
}
registerS3method("tidy_custom", "AGGTEobj", tidy_custom.AGGTEobj, envir = asNamespace("modelsummary"))
registerS3method("glance_custom", "AGGTEobj", glance_custom.AGGTEobj, envir = asNamespace("modelsummary"))
registerS3method("glance_custom", "fixest", glance_custom.fixest, envir = asNamespace("modelsummary"))
registerS3method("tidy", "dose_obj", tidy.dose_obj, envir = asNamespace("generics"))
registerS3method("glance", "dose_obj", glance.dose_obj, envir = asNamespace("generics"))

# Estimators that return a results data frame instead of a model object (didimputation, HonestDiD, ...):
# wrap the package output in modelsummary's documented "modelsummary_list" format.
#   tidy  : data frame with term, estimate, std.error (p.value added if absent)
#   glance: one-row data frame of fit/info rows (nobs, vcov.type, n_clusters, ...)
ae_as_model <- function(tidy, glance = data.frame()) {
  tidy <- as.data.frame(tidy)
  if (!"p.value" %in% names(tidy)) tidy$p.value <- .ae_p(tidy$estimate, tidy$std.error)
  structure(list(tidy = tidy, glance = as.data.frame(glance)), class = "modelsummary_list")
}

# ---- Table export ---------------------------------------------------
.ae_flat <- function(models) if (all(vapply(models, is.list, logical(1))) && !any(vapply(models, function(m) inherits(m, c("fixest", "AGGTEobj", "dose_obj", "lm", "plm", "modelsummary_list")), logical(1)))) unlist(models, recursive = FALSE) else models

.ae_gof_map <- function(models) {
  labs <- ae_labels()
  known <- c(nobs = "Observations", n_units = "Units", r.squared = "R²", adj.r.squared = "Adj. R²",
             r2.within = "Within R²", vcov.type = "Std. errors", n_clusters = "Clusters", control.group = "Control group")
  raw <- unique(unlist(lapply(.ae_flat(models), function(m) names(modelsummary::get_gof(m)))))
  fe <- raw[startsWith(raw, "FE: ")]
  fe_lab <- vapply(sub("^FE: ", "", fe), function(v) paste(if (v %in% names(labs)) labs[[v]] else v, "FE"), character(1))
  keep <- c(fe, intersect(names(known), raw))
  data.frame(raw = keep, clean = c(fe_lab, unname(known[intersect(names(known), raw)])),
             fmt = ifelse(keep %in% c("nobs", "n_units", "n_clusters"), 0, 3))
}

# Shared writer. `build(output)` must return the same modelsummary table for output = "tinytable" or "flextable".
# Writes output/tables/<name>.html (open in RStudio Viewer / browser) and <name>.md, plus <name>.rds holding
# the table objects for the manuscript. No DOCX is written here; Word tables are produced only when the
# manuscript is rendered to DOCX (or when docx = TRUE).
.ae_write_table <- function(build, name, tex = FALSE, docx = FALSE, show = interactive()) {
  dir.create(here::here("output/tables"), showWarnings = FALSE, recursive = TRUE)
  path <- function(ext) here::here("output/tables", paste0(name, ".", ext))
  tt <- build("tinytable")
  ft <- build("flextable")
  ft <- flextable::font(ft, fontname = "Times New Roman", part = "all")
  ft <- flextable::autofit(flextable::fontsize(ft, size = 10, part = "all"))
  saveRDS(list(tinytable = tt, flextable = ft), path("rds"))
  tinytable::save_tt(tinytable::theme_html(tt, portable = TRUE), path("html"), overwrite = TRUE)  # no CDN: works offline in Viewer
  tinytable::save_tt(tt, path("md"), overwrite = TRUE)
  if (tex) tinytable::save_tt(tt, path("tex"), overwrite = TRUE)
  if (docx) flextable::save_as_docx(ft, path = path("docx"))
  if (show) ae_view(path("html"))
  invisible(tt)
}

# Regression table built by modelsummary from fitted models.
#   models : named list ("(1)" = m1, ...); list of named lists gives Panel A/B (names = panel titles)
#   name   : file stem -> output/tables/<name>.html, .md, .rds (+ .tex if tex = TRUE, .docx if docx = TRUE)
#   SE type and cluster count are read from each fitted model (fixest, did); they are never typed in.
#   In an interactive RStudio session the table also opens in the Viewer.
ae_export_table <- function(models, name, title = NULL, notes = NULL, coef_map = NULL, gof_map = NULL,
                            add_rows = NULL, tex = FALSE, docx = FALSE, ...) {
  flat <- .ae_flat(models)
  if (is.null(coef_map)) {
    labs <- ae_labels()
    terms <- unique(unlist(lapply(flat, function(m) modelsummary::get_estimates(m)$term)))
    if (any(terms %in% names(labs))) coef_map <- labs[names(labs) %in% terms]
  }
  if (is.null(gof_map)) gof_map <- .ae_gof_map(models)
  args <- list(models, stars = c("*" = .1, "**" = .05, "***" = .01), fmt = 3, estimate = "{estimate}{stars}",
               statistic = "({std.error})", coef_map = coef_map, gof_map = gof_map, add_rows = add_rows,
               title = title, notes = notes, ...)
  if (!identical(flat, models)) args$shape <- "rbind"
  .ae_write_table(function(output) do.call(modelsummary::modelsummary, c(args, output = output)), name, tex, docx)
}

# Descriptive statistics (N, Mean, SD, Min, P25, Median, P75, Max); row labels from data/codebook.csv.
ae_export_desc <- function(df, vars, name, title = NULL, notes = NULL, tex = FALSE, docx = FALSE) {
  labs <- ae_labels()
  rows <- vapply(vars, function(v) sprintf("(`%s` = %s)", if (v %in% names(labs)) labs[[v]] else v, v), character(1))
  f <- stats::as.formula(paste(paste(rows, collapse = " + "), "~ N + Mean + SD + Min + P25 + Median + P75 + Max"))
  .ae_write_table(function(output) modelsummary::datasummary(f, data = df, fmt = 3, title = title, notes = notes, output = output),
                  name, tex, docx)
}

# Diagnostic / summary table from a data frame computed by an estimation package (Bacon weights,
# HonestDiD bounds, bootstrap p-values, cohort counts...). The data frame must come straight from the
# package output, never from typed numbers.
ae_export_df <- function(df, name, title = NULL, notes = NULL, fmt = 3, tex = FALSE, docx = FALSE) {
  .ae_write_table(function(output) modelsummary::datasummary_df(df, fmt = fmt, title = title, notes = notes, output = output),
                  name, tex, docx)
}

# Display an exported table in the manuscript: tinytable for HTML, native Word table (flextable) for DOCX.
ae_table <- function(name) {
  p <- here::here("output/tables", paste0(name, ".rds"))
  if (!file.exists(p)) stop("Missing output/tables/", name, ".rds; run the script that exports it")
  obj <- readRDS(p)
  tt <- obj$tinytable; ft <- obj$flextable
  # When the chunk sets tbl-cap, Quarto numbers and captions the table; drop the modelsummary title
  # so the caption is not printed twice. Standalone .html/.md exports keep their title.
  if (!is.null(knitr::opts_current$get("tbl-cap"))) {
    tt@caption <- character(0)
    ft$caption$value <- NULL
  }
  if (!identical(knitr::pandoc_to(), "docx")) return(tt)
  # readRDS() does not load flextable; without its namespace knitr has no knit_print method and
  # dumps the object's internal list as code instead of a Word table.
  loadNamespace("flextable")
  ft
}

# ---- Viewer ---------------------------------------------------------
# Viewer-first rule: every table and manuscript preview opens in the RStudio Viewer.
# The Viewer only serves files inside the session temp dir, so the (self-contained) HTML is copied there.
# Outside RStudio it falls back to the browser; in non-interactive Rscript it only prints the path.
ae_view <- function(file) {
  if (!grepl("^(/|[A-Za-z]:)", file)) file <- here::here(file)
  if (!file.exists(file)) stop("File not found: ", file)
  if (requireNamespace("rstudioapi", quietly = TRUE) && rstudioapi::isAvailable()) {
    tmp <- file.path(tempdir(), "ae_view", basename(file))
    dir.create(dirname(tmp), showWarnings = FALSE, recursive = TRUE)
    file.copy(file, tmp, overwrite = TRUE)
    rstudioapi::viewer(tmp)
  } else if (interactive()) {
    utils::browseURL(file)
  } else {
    message("View: ", file)
  }
  invisible(file)
}

# Open an exported table in the Viewer by name: ae_view_table("T3_main")
ae_view_table <- function(name) ae_view(here::here("output/tables", paste0(name, ".html")))

# ---- Figures --------------------------------------------------------
ae_event_plot <- function(df, ref = -1, xlab = "Event time", ylab) {
  aes_ci <- ggplot2::aes(ymin = conf.low, ymax = conf.high)
  p <- ggplot2::ggplot(df, ggplot2::aes(event_time, estimate))
  p <- if ("estimator" %in% names(df)) {
    p + ggplot2::geom_pointrange(ggplot2::aes(ymin = conf.low, ymax = conf.high, shape = estimator), position = ggplot2::position_dodge(width = .4))
  } else p + ggplot2::geom_pointrange(aes_ci)
  p + ggplot2::geom_hline(yintercept = 0) + ggplot2::geom_vline(xintercept = ref + .5, linetype = 2) +
    ggplot2::labs(x = xlab, y = ylab) + ggplot2::theme_classic(base_size = 11)
}
