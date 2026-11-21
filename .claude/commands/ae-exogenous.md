---
description: Find and critically assess real-world sources of exogenous variation for a causal research question
---
Use `$ARGUMENTS` as the research question and any supplied Y, X/treatment, unit/geography, period/frequency, available data, and relevant policies/events/rules. Work in Vietnamese unless the user requests another language. This is a design-discovery command, not an estimation command. Do not require PLAN, LOG, codebook, data-quality PASS, or `/ae-data`; read existing project context and data documentation when useful, without changing them.

## Scope and evidence rules

- Identify no more than three candidate sources. Fewer, including none, is preferable to speculative padding. Search for a real assignment mechanism, not a convenient instrument name.
- Search current authoritative sources when web search is available. Prefer statutes, regulations, agency/government notices and records, official implementation documents, original research papers, and original administrative/technical documentation. Cite a source next to every material factual claim with title/issuer/date and a stable URL. Distinguish official source facts from published research and from the researcher's assumptions. If a source cannot be opened or verified, label the lead `unverified`; never infer its rule, timing, eligibility, exposure, or implementation from a title or a secondary summary alone.
- Reuse available project evidence first: PLAN, LOG, README, variable definitions, data dictionaries, project documents, and panel keys/timing/geography. Treat names, lagged variables, fixed effects, strong first stages, balance, and predictive strength as insufficient by themselves to establish exogeneity.
- Do not fit regressions, search for favorable p-values, change/construct the canonical sample, or edit PLAN/manuscript/data. Do not present a candidate as an instrument or as exogenous until its assignment mechanism and identifying story have been verified and defended.
- If the research question or key design inputs are missing from both `$ARGUMENTS` and project context, ask one concise batch of targeted questions. Do not ask again for information that files already supply. Continue with explicit unknowns when a partial assessment is possible.

## Workflow

1. **Define the target effect.** State the treatment/exposure `D` (the user's X), outcome `Y`, population, unit, geography, treatment timing, outcome horizon, and target estimand. Distinguish ATE/ATT from IV LATE, cutoff-local effects, and exposure-response effects. Explain the specific endogeneity threats that matter here: reverse causality/simultaneity, omitted causes, self-selection/targeting, or measurement error. If treatment, population, or timing is ambiguous, name the ambiguity and its consequence rather than silently choosing.

2. **Search for real assignment variation.** Examine up to three non-duplicative leads, prioritizing documented random/lottery allocation, policy or regulatory changes with a defensible exposure boundary, actual eligibility rules/cutoffs, and external shocks with predetermined differential exposure. For each, answer:
   - What authority, rule, event, or assignment process created the variation? Cite the primary evidence and verify dates, jurisdiction, eligibility, implementation, exceptions, and enforcement where available.
   - Which units were affected and which provide the comparison? Identify the exact observed or proposed assignment/exposure variable and the variation used; distinguish documented facts from assumptions.
   - Which exposure characteristics are predetermined, when measured, and why that timing matters. Assess anticipation, selection, manipulation, compliance, spillovers, and treatment contamination.
   - What causal design and estimand could use this variation, and what identifying assumption would carry the claim?
   - What facts or data are missing before the lead can be treated as a usable design?

3. **Match, do not force, the design.** Consider only methods supported by the actual assignment mechanism:
   - **IV:** state first-stage relevance; independence/exogeneity; exclusion restriction and plausible direct channels; monotonicity if interpreting 2SLS as LATE; define compliers and treatment version. Relevance, a large first stage, or over-identification tests do not prove validity.
   - **DiD/event study:** define actual treated and comparison units, event/effective dates, treatment timing, pre/post windows, and estimand. Assess parallel counterfactual trends, no anticipation, spillovers/interference, composition, staggered timing/heterogeneity, and differential concurrent shocks. Never invent an untreated group.
   - **Continuous/exposure DiD:** state the source of exposure differences and the dose-response estimand; explain the additional assumption linking differential exposure to counterfactual outcome trends. Do not manufacture a zero-exposure or untreated control group.
   - **RDD/fuzzy RDD:** cite the operative threshold and assignment rule, running variable, cutoff, treatment compliance, bandwidth population and local estimand. Assess continuity and sorting/manipulation; distinguish a real administrative threshold from a researcher-chosen cutoff.
   - If another design fits better, explain why. If none is supported, state that the current evidence supports association or a design-only lead, not causal identification.

4. **Referee-style stress test.** For each lead, give its strongest failure path: direct effects on Y, endogenous policy adoption/targeting, anticipation, selective compliance, sorting/manipulation, coinciding shocks, differential trends, spillovers, measurement/source breaks, or invalid comparison. State which are empirically diagnosable and which require institutional evidence or an untestable assumption. Do not equate passing a placebo/balance test with proving the identifying assumption.

5. **Specify evidence and data needs.** List the records/variables, unit-time-geography resolution, treatment/exposure assignment, implementation/compliance, outcome, predetermined covariates, comparison units, and pre/post observations needed. Give feasible falsification/diagnostic checks that would challenge the design (e.g., pre-trends/placebo timing and outcomes, assignment/balance checks, cutoff density/covariate continuity, first-stage and reduced-form checks, spillovers, concurrent-policy mapping). Label each check as observable diagnostic versus assumption needing external/institutional defense. Never choose among leads by p-value.

## Required output

1. One short estimand statement and a concise diagnosis of X's endogeneity risks.
2. A table with these exact columns: `Nguồn biến thiên | Cơ chế phân bổ | Thiết kế | Giả định | Nguy cơ vi phạm | Dữ liệu cần có | Đánh giá`.
3. For each candidate, include citations in the relevant cells or immediately after the table row; separate verified source facts, proposed interpretation, and unverified items. The `Đánh giá` must be `promising`, `conditional`, `weak`, or `unverified`, with the evidence gap that determines the label. These are evidence judgments, not numerical scores.
4. A clear recommendation on which lead merits further investigation and the specific missing evidence. If none is credible, say so directly. Do not make a causal verdict or assert that the proposed design identifies an effect before the data and assumptions are reviewed.
5. A short reference list of verified sources with issuer/authors, title, date, and URL. If live source access was unavailable, say so, preserve exact uncertainty, and do not fabricate citations.

Save the completed assessment to `output/logs/exogenous/<YYYYMMDD_HHMMSS>.md` when running inside a writable project; preserve previous files and use a collision-free name. Also provide the result and report path in chat. This command never changes input data, scripts, PLAN, LOG, or manuscript.
