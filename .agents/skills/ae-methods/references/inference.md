# Inference
1. Cluster at treatment assignment or sampling level.
2. Independent clusters and design-specific assumptions; few clusters weaken conventional asymptotics.
3. Report cluster count and CR1; use `clubSandwich::coef_test(..., vcov="CR2", test="Satterthwaite")`; few-cluster bootstrap `fwildclusterboot::boottest` with restricted null and Webb weights, B=9999 if feasible.
4. G ≥ 50: CR1. G < 50 (Vietnamese bank panels, ≈25–30 banks) or few treated clusters: report CR1, CR2-Satterthwaite and the wild cluster restricted bootstrap side by side and draw conclusions from the most conservative. G < 10: also discuss randomization inference and severe uncertainty. If bootstrap unavailable, CR2/Satterthwaite primary plus `sandwich::vcovBS(type="wild-rademacher")` supplement; never invent WCR p-values.
5. State inference in each table note; report G.
6. Two-way cluster when both dimensions large; DK for cross-sectional dependence and long T.
7. Distinguish uncertainty from identification.
8. Changing SE is not identification robustness. Few treated clusters matter even with large total G.
9. Abadie et al. (2023), DOI 10.1093/qje/qjac038; Cameron & Miller (2015), DOI 10.3368/jhr.50.2.317.
