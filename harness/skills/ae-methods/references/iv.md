# Instrumental variables

## 1. Khi nào dùng & estimand
Use IV only when a defensible instrument generates variation in an endogenous regressor. The estimand is generally the local average treatment effect (LATE) for compliers, not a population ATE. IV diagnostics do not establish instrument validity.

## 2. Giả định bằng lời
- **Relevance**: the instrument predicts the endogenous regressor conditional on included controls and fixed effects.
- **Independence**: conditional on controls and fixed effects, instrument assignment is unrelated to potential outcomes.
- **Exclusion**: the instrument affects the outcome only through the endogenous regressor.
- **Monotonicity**: no units respond to the instrument in the opposite direction.
Exclusion and independence require substantive arguments; an overidentification test cannot prove them.

## 3. Code R (đã chạy trên `AER::CigarettesSW`, 48 states × 2 years)
```r
library(fixest)
library(ivDiag)
data("CigarettesSW", package = "AER")
df <- CigarettesSW
df$log_packs <- log(df$packs)
df$log_price <- log(df$price)
df$log_income <- log(df$income)

# Two-way FE 2SLS; taxes on sales (taxs) instrument price.
m <- feols(log_packs ~ log_income | state + year | log_price ~ taxs,
           data = df, vcov = ~state)
summary(m)
# ivDiag takes variable names and data; do not call as a model-only method.
diag <- ivDiag(data = df, Y = "log_packs", D = "log_price", Z = "taxs",
               controls = "log_income", FE = c("state", "year"), cl = "state",
               bootstrap = FALSE)
diag$F_stat
diag$AR
diag$tF
```
Observed 2SLS price coefficient −1.3116 (state-clustered SE 0.2122; N = 96); `ivDiag` returned clustered first-stage F 120.1 and the package's AR/tF diagnostics. This is a software demonstration, not a defensible causal result: tax exclusion is not established here.

## 4. Kiểm định bắt buộc
Report first-stage relevance using effective/cluster-robust F and weak-IV-robust Anderson–Rubin confidence set; report tF sensitivity where applicable. Inspect balance and pre-period falsification when such outcomes are available. Wu–Hausman tests endogeneity but does not validate exclusion. Report overidentification tests only with overidentified models and never treat non-rejection as proof of validity.

## 5. Thân bài
Main results should place reduced form, first stage, and 2SLS estimates together. State the instrument shift, the endogenous treatment, the complier population, and why exclusion and independence are plausible. Compare OLS and IV as different estimands/specifications, not as a validity contest. Report magnitude and weak-IV-robust interval.

## 6. Phụ lục
Report first-stage equations/diagnostics, AR confidence sets, tF sensitivity, Wu–Hausman, overidentification tests (if available), pre-period falsification, and alternative instrument/control specifications. Show the sample and fixed effects consistently across stages.

## 7. Câu mẫu
- “A one-unit instrument-induced change in X is associated with … among compliers under relevance, independence, exclusion, and monotonicity.”
- “The first-stage diagnostics indicate …; the Anderson–Rubin confidence set is … .”
Do not use causal verbs unless instrument validity is defended and diagnostics do not reveal fatal threats.

## 8. Lỗi hay gặp
- `ivDiag` is not a one-argument model diagnostic; its required API is `ivDiag(data, Y, D, Z, ...)`.
- The `feols` IV formula has three bars/parts: outcome and controls, fixed effects, then endogenous variable and instrument.
- Cluster on the instrument-assignment level and state cluster count.
- Do not use F > 10 as a universal validity test; do not claim exclusion from overidentification non-rejection.
- A strong first stage does not imply a valid instrument; log-transformations do not fix invalidity.

## 9. Tài liệu
Lee, McCrary, Moreira & Porter (2022), DOI 10.1257/aer.20211063. Verified via canonical DOI BibTeX.
