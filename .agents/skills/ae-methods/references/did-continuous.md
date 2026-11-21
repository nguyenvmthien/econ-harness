# Continuous-dose DiD
Code below is copied from `projects/_demo-continuous-did/R/03_main.R` and `04_robustness.R` (ran end-to-end on seeded simulated data).

1. **Khi nào dùng & estimand**: cường độ tác động liên tục, đo trước sự kiện (đóng băng t₀−1). Case A có nhóm D = 0: ATT(d|d), ACRT(d|d), tổng hợp ATTᵒ/ACRTᵒ. Case B mọi đơn vị đều bị tác động: chỉ so sánh giữa các mức dose.
2. **Giả định**: Case A — parallel trends với nhóm D = 0 cho ATT(d); so sánh giữa các dose (ACRT) cần **strong parallel trends**. Case B luôn cần strong PT → trần ngôn ngữ SUGGESTIVE nếu không có lập luận riêng.
3. **Code R**
```r
library(contdid)   # tname phải là số nguyên dương; gname = kỳ bắt đầu (0 cho D = 0)
twfe <- feols(y ~ dose:post | unit_id + time_id, data = df, vcov = ~unit_id)
set.seed(SEED)
cd <- cont_did(yname = "y", dname = "dose", gname = "cohort", tname = "time_id", idname = "unit_id",
               data = df, target_parameter = "slope", aggregation = "dose", treatment_type = "continuous",
               control_group = "nevertreated", bstrap = TRUE, cband = TRUE, biters = 999, degree = 1)
ae_export_table(list("TWFE" = twfe, "Continuous DiD" = cd), "T2_main",
  coef_map = c("dose:post" = "Dose x Post", "ATT (overall)" = "ATT (overall)", "ACRT (overall)" = "ACRT (overall)"))
# Case B: exposed units only, continuous and binned
exposed <- dplyr::filter(df, dose > 0)
exposed$high_dose <- as.integer(exposed$dose >= stats::median(exposed$dose))
b_cont <- feols(y ~ dose:post | unit_id + time_id, data = exposed, vcov = ~unit_id)
b_bin  <- feols(y ~ high_dose:post | unit_id + time_id, data = exposed, vcov = ~unit_id)
es <- feols(y ~ i(time_id, dose, ref = 3) | unit_id + time_id, data = df, vcov = ~unit_id)  # dose event study
```
`cont_did` trả object `dose_obj` (có cả `overall_att` và `overall_acrt`, đường cong `att.d`, `acrt.d` và `*_crit.val`); `functions.R` cung cấp `tidy.dose_obj` để modelsummary đọc trực tiếp.
4. **Kiểm định bắt buộc**: phân phối dose + tỷ lệ D = 0; covariate tiền kỳ theo tercile dose; event study theo dose + kiểm định đồng thời các lead (`fixest::wald(es, keep = "time_id::[12]:")`).
5. **Thân bài**: Bảng TWFE | Continuous DiD (ATTᵒ, ACRTᵒ) — Case A; TWFE | binned — Case B. Hình dose–response ATT(d) với band; hình event study theo dose.
6. **Phụ lục**: dose thay thế (rank, cửa sổ tiền kỳ khác), bỏ top 1% dose, HonestDiD trên event study binned, placebo ngày, suy luận ít cluster.
7. **Câu mẫu**: "A one-unit increase in pre-period exposure is associated with a 1.07 increase in the outcome (ACRT), identified under strong parallel trends." Luôn nêu loại PT, tham số, đơn vị của D.
8. **Lỗi hay gặp**: `tname` bắt đầu từ 0 → `ptetools` báo lỗi; quên `treatment_type = "continuous"`; diễn giải TWFE `dose:post` như ATT; dùng dose đo sau sự kiện. Cảnh báo "critical value for uniform band smaller than pointwise" từ `mboot2` → band thực chất là pointwise, ghi trong notes.
9. **Tài liệu**: Callaway, Goodman-Bacon & Sant'Anna (2024), NBER WP 32117 / arXiv 2107.02637. Exposure dạng share × shock: Goldsmith-Pinkham, Sorkin & Swift (2020) 10.1257/aer.20181047; Borusyak, Hull & Jaravel (2022) 10.1093/restud/rdab030.
