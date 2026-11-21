source(here::here("R/00_packages.R"))
for (f in c("01_build.R","02_describe.R","03_main.R","04_robustness.R","05_extensions.R")) { message("== ",f); source(here::here("R",f),local=new.env()) }
writeLines(capture.output(sessionInfo()),here::here("output/logs/sessionInfo.txt")); writeLines(paste(Sys.time(),"run_all OK"),here::here("output/logs/run_all.txt"))
