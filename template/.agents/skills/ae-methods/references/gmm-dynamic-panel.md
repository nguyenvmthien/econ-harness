# Dynamic panel GMM

## 1. Khi nào dùng & estimand
Use dynamic-panel GMM for panels with many units and few periods when a lagged outcome and specified regressors have a credible sequential moment-condition interpretation. The coefficient is a conditional dynamic association. It is not causal absent defensible instrument validity and exogeneity assumptions.

## 2. Giả định bằng lời
Difference/system GMM requires valid internal lag instruments, no second-order serial correlation in differenced errors, and appropriate restrictions on initial conditions/additional level moments for system GMM. Regressor timing (strictly exogenous, predetermined, endogenous) must be declared and instrumented accordingly. Instrument count must remain controlled relative to the number of groups.

## 3. Code R (đã chạy trên `plm::EmplUK`, 140 firms)
```r
library(plm)
data("EmplUK", package = "plm")
g <- pgmm(emp ~ lag(emp, 1) + wage + capital | lag(emp, 2:99),
          data = EmplUK, index = c("firm", "year"), effect = "twoways",
          model = "twosteps", transformation = "ld", collapse = TRUE)
# robust=TRUE applies the two-step finite-sample corrected covariance in plm.
summary(g, robust = TRUE)
mtest(g, order = 1)
mtest(g, order = 2)
sargan(g)
# Instrument dimension for this fitted collapsed specification:
ncol(g$W[[1]])
length(unique(EmplUK$firm))
```
Observed two-step robust estimates: lagged employment 0.6594 (SE 0.2166), wage −0.0510 (SE 0.0265), capital 0.6474 (SE 0.5006). Sargan p = 0.2208; Arellano–Bond AR(1) p = 0.160 and AR(2) p = 0.121. The fitted instrument matrix has 20 columns for 140 firms. This demonstrates execution only; AR(1) did not reject in this sample, an unusual diagnostic result that must be reported rather than suppressed. Sargan is not robust to arbitrary heteroskedasticity.

## 4. Kiểm định bắt buộc
Report AR(1), AR(2), Hansen/Sargan (identify which test is robust), the exact lag window, instrument count, group count, and two-step covariance correction. Report sensitivity to shorter lag windows and collapsed versus non-collapsed instruments. Non-rejection of AR(2) or Hansen/Sargan does not prove instrument validity.

## 5. Thân bài
Include estimates in the main text only if the moment conditions and instrument discipline are defensible. State the outcome persistence coefficient, sample, dynamic horizon, lag window, instrument count versus groups, and diagnostic outcomes. Interpret conditional dynamics; avoid causal terms without independent identification.

## 6. Phụ lục
Show difference-in-Hansen/Hansen diagnostics when supported, alternative lag ranges, collapsed versus uncollapsed instrument sets, one-step versus two-step results, and disclosed regressor timing assumptions. Keep the instrument count visible for each specification.

## 7. Câu mẫu
- “Conditional on the included regressors and the stated moment restrictions, lagged employment is positively associated with current employment.”
- “The AR(2) test [rejects/does not reject] at …; the overidentification test is …, with … instruments and … groups.”

## 8. Lỗi hay gặp
- `transformation = "ld"` selects system GMM; `model = "twosteps"` selects two-step; `collapse = TRUE` must be stated explicitly.
- In `plm`, use `summary(g, robust = TRUE)` for corrected two-step inference; report the exact option.
- An AR(1) non-rejection is atypical and should be transparently discussed, not interpreted as confirmation.
- `sargan()` is not a heteroskedasticity-robust Hansen test; label the actual test.
- A collapsed instrument set can still be numerous; compare count to groups and vary lag windows.
- For small N (including typical bank panels), instrument proliferation and finite-sample bias make this estimator unsuitable as an automatic primary model.

## 9. Tài liệu
Roodman (2009), DOI 10.1111/j.1468-0084.2008.00542.x. Verified via canonical DOI BibTeX.
