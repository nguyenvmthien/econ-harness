# Pooled OLS, FE, RE, TWFE (associational panel)

## 1. Khi nào dùng & estimand
- Không có biến thiên ngoại sinh (chính sách, instrument, ngưỡng) → bài **associational**; verdict tối đa ASSOCIATIONAL (`ae-design`).
- Tham số: hệ số của X trong kỳ vọng có điều kiện. FE: liên hệ **trong cùng đơn vị** theo thời gian (within); TWFE: within sau khi bỏ cú sốc chung theo năm; pooled OLS: liên hệ cả giữa lẫn trong đơn vị; RE: trung bình có trọng số của between và within.
- Panel ngân hàng Việt Nam ≈ 25–30 ngân hàng → ít cluster → luôn kèm bảng suy luận (mục 4, `inference.md`).

## 2. Giả định bằng lời
| Mô hình | Giả định để hệ số không chệch cho tham số của nó |
|---|---|
| Pooled OLS | Không có đặc điểm cố định của đơn vị tương quan với X |
| FE | Strict exogeneity: sai số các kỳ không tương quan với X mọi kỳ, sau khi bỏ α_i; X phải biến thiên trong đơn vị |
| TWFE | Như FE, và cú sốc chung theo năm được bỏ bằng λ_t |
| RE | Như FE **và** α_i không tương quan với X (thường khó bảo vệ với dữ liệu ngân hàng/doanh nghiệp) |
Biến không đổi theo thời gian (sở hữu nhà nước, niêm yết) bị FE hấp thụ: không ước lượng được hệ số của nó trong FE; muốn xét thì dùng tương tác với biến thay đổi theo thời gian.

## 3. Code R (đã chạy trên `plm::Grunfeld`, 10 công ty × 20 năm)
Dữ liệu có `unit_id`, `time_id`; `pdf` là `pdata.frame` cho các hàm `plm`. Bảng xuất bằng `ae_export_table()`/`ae_export_df()` (`ae-tables`).
```r
library(plm); library(lmtest); library(clubSandwich); library(fwildclusterboot); library(sensemakr)
df  <- readRDS(here::here("data/analysis.rds"))
pdf <- pdata.frame(df, index = c("unit_id", "time_id"))
f   <- inv ~ value + capital

# ---- T2 Baseline: four progressive columns (fixest, SE clustered by unit) ----
m1 <- feols(inv ~ value,                          data = df, vcov = ~unit_id)
m2 <- feols(f,                                    data = df, vcov = ~unit_id)
m3 <- feols(inv ~ value + capital | unit_id,           data = df, vcov = ~unit_id)
m4 <- feols(inv ~ value + capital | unit_id + time_id, data = df, vcov = ~unit_id)
saveRDS(list(m1 = m1, m2 = m2, m3 = m3, m4 = m4), here::here("output/models/baseline.rds"))
ae_export_table(list("(1)" = m1, "(2)" = m2, "(3)" = m3, "(4)" = m4), "T2_baseline",
  title = "Market value and firm investment",
  notes = "Dependent variable: gross investment. Standard errors clustered by firm in parentheses. * p<0.10, ** p<0.05, *** p<0.01.")

# ---- TA1 Pooled OLS vs FE vs RE (plm) with the panel specification tests ----
pool <- plm(f, data = pdf, model = "pooling")
fe   <- plm(f, data = pdf, model = "within")
re   <- plm(f, data = pdf, model = "random")
cl   <- function(m) vcovHC(m, method = "arellano", type = "HC1", cluster = "group")
ftest <- pFtest(fe, pool)                                   # H0: no unit effects (pooled OK)
lm_bp <- plmtest(pool, type = "bp")                         # H0: no random effects (pooled OK)
haus  <- phtest(f, data = pdf, method = "aux", vcov = cl)   # H0: RE consistent (cluster-robust Hausman)
ae_export_table(list("Pooled OLS" = pool, "FE" = fe, "RE" = re), "TA1_pool_fe_re",
  vcov = list(cl(pool), cl(fe), cl(re)),
  add_rows = data.frame(term = c("F test: unit effects (p)", "Breusch-Pagan LM: random effects (p)", "Robust Hausman: FE vs RE (p)"),
                        a = sprintf("%.3f", c(ftest$p.value, lm_bp$p.value, haus$p.value)), b = "", c = ""),
  title = "Pooled OLS, fixed effects and random effects",
  notes = "Dependent variable: gross investment. Cluster-robust (Arellano, by firm) standard errors in parentheses.")

# ---- TA2 Specification diagnostics ----
tests <- list(
  "F test, unit effects (FE vs pooled)"             = ftest,
  "Breusch-Pagan LM, random effects (RE vs pooled)" = lm_bp,
  "Hausman, cluster-robust (FE vs RE)"              = haus,
  "Breusch-Godfrey/Wooldridge serial correlation"   = pbgtest(fe),
  "Breusch-Pagan heteroskedasticity"                = bptest(lm(f, data = df)),
  "Pesaran CD cross-sectional dependence"           = pcdtest(fe, test = "cd"))
diag_tab <- data.frame(Test = names(tests),
  Statistic = vapply(tests, function(t) unname(t$statistic), numeric(1)),
  `p-value` = vapply(tests, function(t) t$p.value, numeric(1)), check.names = FALSE, row.names = NULL)
ae_export_df(diag_tab, "TA2_spec_tests", title = "Panel specification tests")
vif <- car::vif(lm(f, data = df))

# ---- TA3 Inference for the TWFE coefficient: CR1 vs CR2-Satterthwaite vs wild cluster bootstrap ----
fe2 <- plm(f, data = pdf, model = "within", effect = "twoways")
cr2 <- coef_test(fe2, vcov = "CR2", cluster = pdf$unit_id, test = "Satterthwaite")  # two-way plm: cluster must be given
set.seed(SEED); dqrng::dqset.seed(SEED)
wcr <- boottest(m4, param = "value", clustid = "unit_id", B = 9999, type = "webb")
dk  <- feols(inv ~ value + capital | unit_id + time_id, data = df, panel.id = ~unit_id + time_id, vcov = "DK")
ci  <- function(lo, hi) sprintf("[%.3f, %.3f]", lo, hi)
cr2_ci <- conf_int(fe2, vcov = "CR2", cluster = pdf$unit_id, coefs = "value")
inf_tab <- data.frame(
  Procedure = c("CR1 (fixest)", "CR2 + Satterthwaite (clubSandwich)", "Wild cluster restricted bootstrap (Webb, B = 9,999)", "Driscoll-Kraay"),
  `Std. error` = c(se(m4)[["value"]], cr2$SE[1], NA, se(dk)[["value"]]),
  `p-value`    = c(pvalue(m4)[["value"]], cr2$p_Satt[1], pval(wcr), pvalue(dk)[["value"]]),
  `95% CI`     = c(ci(confint(m4)["value", 1], confint(m4)["value", 2]), ci(cr2_ci$CI_L, cr2_ci$CI_U),
                   ci(confint(wcr)[1], confint(wcr)[2]), ci(confint(dk)["value", 1], confint(dk)["value", 2])),
  check.names = FALSE)
ae_export_df(inf_tab, "TA3_inference", title = "Inference for the market-value coefficient (two-way FE)",
  notes = sprintf("Two-way FE estimate of the market-value coefficient. Clusters: %d firms. CR2 uses Satterthwaite degrees of freedom; the bootstrap reports a p-value and confidence set, not a standard error.", fixest::fitstat(m4, "g")[[1]]))

# ---- Omitted-variable sensitivity (sensemakr on the pooled model with controls) ----
sens <- sensemakr(lm(f, data = df), treatment = "value", benchmark_covariates = "capital", kd = 1:3)
```
Ghi chú đã kiểm khi chạy:
- `fixest` không ghép được FE qua `update(f, . ~ . | unit_id)`: viết đầy đủ công thức.
- `feols` không truyền `vcov` thì mặc định cluster theo FE đầu tiên: luôn ghi `vcov` tường minh.
- `coef_test()` trên `plm` hai chiều (`effect = "twoways"`) bắt buộc truyền `cluster =`.
- `boottest()` cần cả `set.seed()` và `dqrng::dqset.seed()` mới tái lập được.
- Với 10 cluster: CR1 SE 0,011 (p < 0,001), CR2 SE 0,021 (Satterthwaite df 2,4; p = 0,020). Cùng hệ số, CR1 của `clubSandwich` ≈ `fixest` (0,0102 vs 0,0108) → chênh là hiệu chỉnh ít-cluster thật, không phải lỗi.

## 4. Kiểm định bắt buộc
| Kiểm định | Hàm | H0 | Đọc thế nào | Vị trí |
|---|---|---|---|---|
| F unit effects | `pFtest(fe, pool)` | Không có hiệu ứng đơn vị | Bác bỏ → pooled OLS không đủ | TA1, TA2 |
| Breusch–Pagan LM | `plmtest(pool, type = "bp")` | Phương sai α_i = 0 | Bác bỏ → có hiệu ứng ngẫu nhiên | TA1, TA2 |
| Hausman **robust** | `phtest(f, data, method = "aux", vcov = cl)` | RE nhất quán | Bác bỏ → dùng FE. Hausman cổ điển sai khi SE cluster | TA1, TA2 |
| Tự tương quan | `pbgtest(fe)` | Không tự tương quan | Bác bỏ → bắt buộc SE cluster theo đơn vị | TA2 |
| Phương sai thay đổi | `lmtest::bptest()` | Đồng nhất | Bác bỏ → SE robust/cluster | TA2 |
| Phụ thuộc chéo | `pcdtest(fe, test = "cd")` | Độc lập giữa đơn vị | Bác bỏ và T ≥ 20 → thêm Driscoll–Kraay | TA2, TA3 |
| VIF | `car::vif()` trên pooled | — | > 10 → nêu; không bỏ biến chỉ vì VIF | Phụ lục |
| Suy luận ít cluster | CR1, `coef_test(vcov = "CR2", test = "Satterthwaite")`, `boottest()` | β = 0 | Báo cả ba khi G < 50; kết luận theo thủ tục thận trọng nhất (`inference.md`) | TA3 |
| Omitted variable | `sensemakr(lm, treatment, benchmark_covariates, kd = 1:3)` | — | Robustness value: confounder phải mạnh cỡ nào để triệt tiêu hệ số | Phụ lục |
Các kiểm định này chọn **cách tính SE và mô hình báo cáo**; chúng không biến kết quả thành nhân quả.

## 5. Thân bài
1. Bảng mô tả + ma trận tương quan (Section 3).
2. **Bảng baseline 4 cột tiến dần**: (1) pooled, chỉ X; (2) + controls; (3) + unit FE; (4) + unit FE + year FE. Cột chính (thường (4)) ghi trước trong PLAN §8. Dòng FE, Observations, Clusters, R², Within R², loại SE.
3. Độ lớn kinh tế trong prose: β × SD(X), so với mean(Y).
4. Robustness tổng hợp một bảng (chọn trước trong PLAN): đo DV khác; winsorize 1/99 vs không; X trễ t−1; bỏ 2020–2021; tách nhóm (quốc doanh vs cổ phần).
5. Heterogeneity: tương tác X × nhóm định trước.

## 6. Phụ lục
- TA1 Pooled OLS | FE | RE với SE cluster (Arellano) + dòng p của F, BP-LM, Hausman robust.
- TA2 bảng kiểm định đặc tả; VIF.
- TA3 suy luận: CR1 | CR2-Satterthwaite | wild cluster bootstrap | Driscoll–Kraay (SE, p, CI 95%).
- `sensemakr`: robustness value + bound theo control mạnh nhất.
- FGLS/PCSE chỉ là cột phụ lục khi journal yêu cầu; không đổi estimator chính vì kiểm định bác bỏ.

## 7. Câu mẫu (ASSOCIATIONAL)
- "A one-standard-deviation increase in X is associated with a [β×SD] increase in Y, about [x]% of its sample mean."
- "Within banks over time, X is positively associated with Y; the estimate is similar with year fixed effects (column 4)."
- "The association remains statistically distinguishable from zero under CR2 small-sample corrections (p = …) and the wild cluster bootstrap (p = …)."
- FE: "absorbs time-invariant bank heterogeneity"; không viết "controls for endogeneity", "effect", "impact", "determinant".

## 8. Lỗi hay gặp
- Chọn FE/RE bằng Hausman cổ điển khi SE cluster; hoặc chọn mô hình "nào có sao".
- Không ghi `vcov`, để `fixest` tự cluster; hoặc báo SE thường với panel có tự tương quan.
- Đổi sang FGLS vì kiểm định bác bỏ; đưa RE làm kết quả chính khi Hausman robust bác bỏ.
- Báo R² overall cho FE mà không nói rõ; so R² giữa pooled và FE như thể cùng loại.
- Diễn giải hệ số FE như so sánh giữa các ngân hàng (thực ra là trong cùng ngân hàng).
- Chỉ báo CR1 khi G ≈ 25–30; không báo số cluster.
- Thêm control "xấu" (chịu tác động của X) làm mất kênh, hoặc lọc mẫu theo biến kết quả.

## 9. Tài liệu
Hausman (1978), DOI 10.2307/1913827; Petersen (2009), DOI 10.1093/rfs/hhn053; Driscoll & Kraay (1998), DOI 10.1162/003465398557825; Pustejovsky & Tipton (2018), DOI 10.1080/07350015.2016.1247004; MacKinnon, Nielsen & Webb (2023), DOI 10.1016/j.jeconom.2022.04.001; Cinelli & Hazlett (2020), DOI 10.1111/rssb.12348.
