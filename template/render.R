# ==== render.R ========================================================
# Render the manuscript (paper/manuscript.qmd) from R. VIEWER FIRST: the HTML version is always
# rendered and opened in the RStudio Viewer before anything else; DOCX is only produced on request,
# after the HTML preview.
# ======================================================================

DOCX       <- FALSE
RUN_MODELS <- FALSE
args <- commandArgs(trailingOnly = TRUE)
if (length(args)) {
  DOCX <- "docx" %in% args
  RUN_MODELS <- "run" %in% args
}

here::i_am("render.R")
root <- here::here()
qmd <- file.path(root, "paper", "manuscript.qmd")
rscript <- Sys.which("Rscript")
if (!nzchar(rscript)) stop("Rscript not found on PATH; manuscript audit cannot run.")
with_root <- function(expr) {
  old <- getwd()
  on.exit(setwd(old), add = TRUE)
  setwd(root)
  force(expr)
}

render_to <- function(fmt) {
  message("== Rendering ", basename(qmd), " to ", toupper(fmt))
  t0 <- Sys.time()
  status <- with_root(system2(quarto, c("render", shQuote(qmd), "--to", fmt)))
  if (status != 0) stop("Quarto render failed (exit ", status, "). See the messages above.")
  out <- file.path(root, "output", "paper", paste0("manuscript.", fmt))
  message(sprintf("== Done in %.1f s: %s", as.numeric(difftime(Sys.time(), t0, units = "secs")), out))
  out
}

if (RUN_MODELS) {
  message("== Running run_all.R")
  source(file.path(root, "run_all.R"), local = new.env())
}

message("== Running manuscript audit")
audit_status <- with_root(system2(rscript, c(shQuote(file.path(root, "R", "99_audit.R")), "manuscript")))
if (audit_status != 0) stop("Manuscript audit failed (exit ", audit_status, "). See output/logs/audit_manuscript.md.")
quarto <- Sys.which("quarto")
if (!nzchar(quarto)) stop("Quarto CLI not found on PATH. Install from https://quarto.org or reopen RStudio.")

source(file.path(root, "R", "functions.R"), local = TRUE)
ae_view(render_to("html"))
if (DOCX) render_to("docx")
