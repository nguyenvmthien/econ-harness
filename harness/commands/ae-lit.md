---
description: Search applied-economics literature on specified research dimensions
---
Read `$ARGUMENTS`, `PLAN.md`, and `LOG.md` before searching. If the goal, core topic/constructs, setting or data status, and scope are already clear, do not ask again.

Otherwise ask once in one grouped turn, and only for missing material:
1. Goal: find papers, map a gap, or develop candidate ideas.
2. Core question/topic, including X/Y or mechanism if known.
3. Population/setting and available data (or undecided).
4. Year range and relevant publication types/language.
5. Journal-rank preference and desired output, if relevant.

Do not assume Vietnam or a causal question unless the user or PLAN specifies it. From the answers, compose a concise search brief with explicit assumptions and query axes; show it, then proceed without another confirmation unless a material ambiguity remains.

Use one `topic_search` across 3–8 distinct query variants adapted to the brief; use `paper_search` for one exact paper/DOI. Apply local journal-rank filters only when requested. Read candidate metadata with `paper_get`; use references/citations and `paper_related` selectively on the strongest seeds (`coupling` for close siblings, `cocitation` for foundations; avoid `both` unless needed). Deduplicate by DOI/ID, append only tool-backed metadata to `literature/EVIDENCE.csv`, then ask which papers to cite.

For selected papers run `/ae-cite <DOI>`. Then, in one parallel batch, dispatch one `ae-lit-reader` per selected paper with `literature/pdf/<citekey>.pdf` or an OA PDF URL from `paper_get`, passing citekey, DOI, PDF path or URL, and PLAN §1–4 verbatim. Set `fulltext_read` in `literature/EVIDENCE.csv` to `yes` when the reader returned OK, `failed` on CANNOT-READ, and `no-oa` when no PDF or URL exists.

Summarize verified gaps and append a dated LOG entry; update Next.
