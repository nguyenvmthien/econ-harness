# 2×2 DiD and event study
1. Two-group/two-period or event-time design; ATT under parallel trends and no anticipation.
2. Compare untreated potential-outcome changes across treated/control groups.
3. `feols(y ~ treat:post | unit_id + time_id, data=df, vcov=~assignment_cluster)`; controls should be predetermined.
4. Report event-study 95% CI and joint lead Wald test; balance table pre-period. Appendix: HonestDiD M∈{0,.5,1,1.5,2}, placebo date/outcome, anticipation window, DRDID for conditional PT, alternate controls.
5. Main baseline then event-study figure; lead test reported in prose.
6. Include sensitivity bounds and falsifications.
7. Say “no evidence of differential pre-trends,” never “parallel trends hold.”
8. Lead tests have low power; Roth (2022), DOI 10.1257/aeri.20210236.
9. Sant’Anna & Zhao (2020), DOI 10.1016/j.jeconom.2020.06.003.
