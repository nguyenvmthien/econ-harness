# Staggered adoption DiD
Code below is copied from `projects/_demo-staggered-did/R/03_main.R` and `04_robustness.R` (ran end-to-end on did::mpdta).

1. **Khi nào dùng & estimand**: nhiều cohort áp dụng ở các thời điểm khác nhau; ATT(g,t) gộp thành ATT tổng, theo cohort, theo event time. Ghi rõ nhóm so sánh (never-treated / not-yet-treated).
2. **Giả định**: không anticipation; parallel trends có điều kiện với nhóm so sánh đã chọn.
3. **Code R**
```r
library(did)
twfe <- feols(lemp ~ post | unit_id + time_id, data = df, vcov = ~unit_id)            # benchmark only
set.seed(SEED)
cs <- att_gt(yname = "lemp", tname = "year", idname = "countyreal", gname = "first.treat",
             data = df, control_group = "nevertreated", base_period = "universal",
             clustervars = "countyreal", bstrap = TRUE, cband = TRUE)
cs_simple  <- aggte(cs, type = "simple"); cs_group <- aggte(cs, type = "group")
cs_dynamic <- aggte(cs, type = "dynamic", cband = TRUE)
# Sun-Abraham: never-treated coded beyond the sample period
sa <- feols(lemp ~ sunab(cohort_sa, year) | unit_id + time_id, data = df_sa, vcov = ~unit_id)
sa_att <- summary(sa, agg = "ATT")
library(didimputation)   # Borusyak-Jaravel-Spiess
bjs <- did_imputation(data = df, yname = "lemp", gname = "first.treat", tname = "year",
                      idname = "countyreal", cluster_var = "countyreal")
bjs_model <- ae_as_model(data.frame(term = "ATT", estimate = bjs$estimate, std.error = bjs$std.error),
  data.frame(nobs = nrow(df), vcov.type = "Clustered (countyreal)", n_clusters = dplyr::n_distinct(df$countyreal)))
ae_export_table(list("TWFE" = twfe, "Sun-Abraham" = sa_att, "Callaway-Sant'Anna" = cs_simple, "Borusyak et al." = bjs_model),
  "T4_estimators", coef_map = c(post = "Treated x Post", ATT = "Treated x Post", "ATT(simple average)" = "Treated x Post"))
```
4. **Kiểm định bắt buộc**: bảng cohort (số đơn vị theo năm áp dụng, số never-treated); event study với uniform band (`cband = TRUE`); Goodman-Bacon `bacondecomp::bacon(y ~ post, data = <chỉ các cột cần>, id_var, time_var)` — truyền tối giản cột vì hàm tự tạo cột `treated`; HonestDiD relative magnitudes M̄ ∈ {0, 0.5, 1, 1.5, 2}. Với `sunab`, `vcov()` là cấp cohort: dựng vcov đã gộp bằng `sunab_beta_vcv()` trong `04_robustness.R` (khớp `aggregate()` chính xác) trước khi đưa vào HonestDiD.
5. **Thân bài**: Bảng TWFE (ghi "benchmark") | CS simple ATT; Hình event study CS; Bảng so sánh estimator TWFE / SA / CS / BJS; Hình event study theo estimator.
6. **Phụ lục**: Bacon; HonestDiD (bảng + hình); suy luận CR1 / CR2-Satterthwaite / wild cluster bootstrap (`set.seed(SEED); dqrng::dqset.seed(SEED)` trước `boottest`); dCDH (`DIDmultiplegtDYN`) khi treatment bật/tắt.
7. **Câu mẫu**: SUGGESTIVE — "Across heterogeneity-robust estimators, the ATT ranges from −0.040 to −0.048 log points, consistent with a reduction in teen employment." Không viết "parallel trends hold"; viết "no evidence of differential pre-trends".
8. **Lỗi hay gặp**: quên `library(did)` → modelsummary không nhận object; dùng TWFE làm kết quả chính khi có hiệu ứng dị biệt theo cohort; mã never-treated là 0 trong `sunab`.
9. **Tài liệu**: Callaway & Sant'Anna (2021) 10.1016/j.jeconom.2020.12.001; Sun & Abraham (2021) 10.1016/j.jeconom.2020.09.006; Borusyak, Jaravel & Spiess (2024) 10.1093/restud/rdae007; Goodman-Bacon (2021) 10.1016/j.jeconom.2021.03.014; Rambachan & Roth (2023) 10.1093/restud/rdad018. (DOI chưa đối chiếu qua doi.org.)
