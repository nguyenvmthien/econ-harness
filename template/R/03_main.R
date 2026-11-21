# ==== 03_main.R ====================================================
# Purpose: <...>
# Output:  output/tables/<name>.html|.md|.rds, output/figures/<name>.png
# ====================================================================
source(here::here("R/00_packages.R")); source(here::here("R/functions.R"))
df <- readRDS(here::here("data/analysis.rds"))

# Estimate, then export finished tables in this script:
#   m1 <- feols(y ~ x | unit_id + time_id, data = df, vcov = ~unit_id)
#   ae_export_table(list("(1)" = m1, "(2)" = m2), "T2_baseline", title = "...", notes = "...")
#   ae_export_desc(df, c("y", "x"), "T1_descriptives")
#   saveRDS(list(m1 = m1, m2 = m2), here::here("output/models/baseline.rds"))   # reuse later / numbers in prose
#   ggsave(here::here("output/figures/F1_event.png"), p, width = 6.5, height = 4, dpi = 300)
# Method playbooks: skill://ae-methods
