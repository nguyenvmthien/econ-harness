args <- commandArgs(trailingOnly = TRUE)
if (length(args) > 1L || (length(args) == 1L && args[[1L]] != "manuscript")) {
  cat("Usage: Rscript R/99_audit.R [manuscript]\n", file = stderr())
  quit(status = 2L)
}

mode <- if (length(args)) "manuscript" else "full"
here::i_am("R/99_audit.R")
root <- here::here()
results <- character()
record <- function(ok, label, detail = "") {
  results <<- c(results, paste(if (ok) "PASS" else "FAIL", "—", label, "—", detail))
}
check_file <- function(path, label) {
  if (!file.exists(path)) {
    record(FALSE, label, paste("Missing:", path))
    return(NULL)
  }
  tryCatch(readLines(path, warn = FALSE), error = function(e) {
    record(FALSE, label, paste("Unreadable:", conditionMessage(e)))
    NULL
  })
}

qmd_lines <- check_file(file.path(root, "paper", "manuscript.qmd"), "Manuscript QMD")
bib_lines <- check_file(file.path(root, "paper", "references.bib"), "Bibliography")
if (!is.null(qmd_lines) && !is.null(bib_lines)) {
  qmd <- paste(qmd_lines, collapse = "\n")
  bib <- paste(bib_lines, collapse = "\n")
  key_matches <- regmatches(qmd, gregexpr("(?<![\\w.])@([A-Za-z][\\w:.-]*)", qmd, perl = TRUE))[[1L]]
  keys <- sub("^@", "", key_matches)
  keys <- sub("[.,;:]+$", "", keys)
  keys <- keys[!grepl("^(tbl-|fig-|eq-|sec-)", keys)]
  entries <- regmatches(bib, gregexpr("@\\w+\\s*\\{\\s*[^,]+,", bib, perl = TRUE))[[1L]]
  bibkeys <- trimws(sub("^@\\w+\\s*\\{\\s*([^,]+),.*$", "\\1", entries))
  record(!anyDuplicated(bibkeys), "Bibliography keys unique", paste(unique(bibkeys[duplicated(bibkeys)]), collapse = ", "))
  record(all(keys %in% bibkeys), "Citation keys resolve to bibliography", paste(setdiff(unique(keys), bibkeys), collapse = ", "))

  table_matches <- regmatches(qmd, gregexpr("ae_table\\s*\\(\\s*['\"]([^'\"]+)['\"]\\s*\\)", qmd, perl = TRUE))[[1L]]
  table_matches <- table_matches[!is.na(table_matches) & nzchar(table_matches)]
  table_names <- unique(sub("^.*['\"]([^'\"]+)['\"].*$", "\\1", table_matches))
  missing_tables <- if (length(table_names)) table_names[!file.exists(file.path(root, "output", "tables", paste0(table_names, ".rds")))] else character()
  record(!length(missing_tables), "Manuscript tables exported", paste(missing_tables, collapse = ", "))
}

if (mode == "full") {
  source(file.path(root, "R", "functions.R"), local = TRUE)
  raw_ok <- tryCatch({ ae_check_raw(); TRUE }, error = function(e) {
    record(FALSE, "Raw manifest integrity", conditionMessage(e)); FALSE
  })
  if (raw_ok) record(TRUE, "Raw manifest integrity")
  analysis_path <- file.path(root, "data", "analysis.rds")
  record(file.exists(analysis_path), "Analysis dataset exists", if (file.exists(analysis_path)) "" else "run R/01_build.R")
  if (file.exists(analysis_path)) {
    data <- tryCatch(readRDS(analysis_path), error = function(e) {
      record(FALSE, "Analysis dataset readable", conditionMessage(e)); NULL
    })
    if (!is.null(data)) {
      cb_path <- file.path(root, "data", "codebook.csv")
      codebook <- tryCatch(read.csv(cb_path, stringsAsFactors = FALSE), error = function(e) {
        record(FALSE, "Codebook readable", conditionMessage(e)); NULL
      })
      if (!is.null(codebook)) {
        required <- c("variable", "label", "definition", "unit", "source", "type", "construction")
        missing_fields <- setdiff(required, names(codebook))
        duplicates <- if ("variable" %in% names(codebook)) unique(codebook$variable[duplicated(codebook$variable)]) else character()
        record(!length(missing_fields), "Codebook fields present", paste(missing_fields, collapse = ", "))
        record(!length(duplicates), "Codebook variables unique", paste(duplicates, collapse = ", "))
        undocumented <- setdiff(names(data), if ("variable" %in% names(codebook)) codebook$variable else character())
        record(!length(undocumented), "Analysis columns documented in codebook", paste(undocumented, collapse = ", "))
        if (!length(missing_fields)) {
          analysis_rows <- codebook[codebook$variable %in% names(data), required, drop = FALSE]
          descriptions <- analysis_rows[, required[-1L], drop = FALSE]
          described <- as.matrix(data.frame(lapply(descriptions, function(column) !is.na(column) & nzchar(trimws(as.character(column))))))
          incomplete <- if (nrow(analysis_rows)) analysis_rows$variable[!apply(described, 1L, all)] else character()
          record(!length(incomplete), "Analysis variables fully described", paste(incomplete, collapse = ", "))
        }
      }
    }
  }
}

log_path <- file.path(root, "output", "logs", if (mode == "full") "audit.md" else "audit_manuscript.md")
dir.create(dirname(log_path), showWarnings = FALSE, recursive = TRUE)
writeLines(results, log_path)
if (any(grepl("^FAIL", results))) quit(status = 1L)
