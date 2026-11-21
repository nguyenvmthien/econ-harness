---
name: ae-literature
description: Use when searching empirical literature or adding and checking manuscript references.
---
# Evidence and citations
## Intake before research-discovery

Before the first discovery-tool call, inspect the user's request plus `PLAN.md` and `LOG.md`.
Ask **once, in a single grouped turn**, only for material details that remain unclear:

1. Goal: find relevant papers, map the literature/gap, or develop candidate research ideas.
2. Topic/question: key constructs and, if known, treatment/exposure, outcome, and mechanism.
3. Setting and data: population, geography, unit, period, and whether data already exist.
4. Scope: publication-year range, publication types, and language.
5. Optional constraints: journal-rank system/threshold and desired deliverable.

Do not ask for information already stated in the request or project files. Do not assume a Vietnam
setting, a causal question, or a journal-rank threshold. If the user has data but no settled question,
use a data-first search brief; otherwise use a topic-first brief. If the user is undecided on a
non-essential item, state a conservative default rather than adding another question.

After the answer, write a concise search brief with the goal, scope, explicit assumptions, and 3–8
distinct query axes. Show the brief and proceed; do not ask for a second confirmation unless a
remaining ambiguity would materially change which literature is searched. Treat the brief as a
discovery plan, not as evidence of novelty or causal identification.

Choose query axes from the agreed search brief—for example construct synonyms, mechanism, outcome, methods/design, or geography when relevant; do not assume a Vietnam axis. Record only returned DOI/IDs in `EVIDENCE.csv`: citekey, DOI, year, journal, country, data, design, estimator, finding/magnitude, relevance, full-text status. `$ae-cite` is the sole writer of references.bib; get canonical BibTeX from DOI content negotiation, never reconstruct from memory. Citekey: normalized first-author surname + year + first non-stopword title token; collisions suffix b/c. Independent citation check: compare exact normalized title, year, first-author surname with paper metadata and CrossRef; inspect abstract/full text against each cited sentence; assign SUPPORTED/PARTIAL/NOT-SUPPORTED/CANNOT-VERIFY and record short evidence and location. Retraction marker fails metadata. No DOI/ID returned means no citation row. Journal rank is optional, not a gate.

## Tool research-discovery (`mcp__research_discovery_*`, mã nguồn `harness/mcp/research-discovery`)
| Việc | Tool |
|---|---|
| Quét một chủ đề bằng nhiều cách diễn đạt | `topic_search` (có `year_from`/`year_to`) |
| Lọc/xếp hạng tạp chí cục bộ theo ISSN/tên | `journal_rank_lookup` (SJR 2025 Q1/Q2; ABDC 2025 A*/A/B) |
| Tìm theo từ khóa hoặc resolve một DOI | `paper_search` |
| Abstract (kèm `abstractSource`), venue, link OA PDF | `paper_get` |
| Bài được trích / bài trích dẫn | `paper_references` / `paper_citations` (`sort: "citationCount"` để lấy bài nhiều trích dẫn nhất) |
| Bài cùng chủ đề gần đây (coupling), bài nền tảng (co-citation) | `paper_related` (~6 giây; gọi lại trong 7 ngày lấy từ cache) |
| Mạng của một tập bài hạt giống; "similar work" | `network_expand` (một hạt giống + `include: ["similar"]`) |
| Tác giả | `author_search`, `author_get`, `author_papers` |

Với tìm kiếm nhiều tiêu chí, dùng một `topic_search` có `year_from`/`year_to` và
`journal_rank_source` (`"SJR"` hoặc `"ABDC"`), kèm `journal_ranks`; `sort: "journalRank"` để ưu tiên
rank cao. `journal_subject_category` chỉ dùng với SJR; `journal_field_of_research` chỉ dùng với ABDC
và nên chọn đúng FoR (ví dụ `3801` cho economics). Năm xuất bản bài và năm rank là hai mốc riêng;
index hiện tại là 2025. Rank được đối chiếu cục bộ theo tên venue đã chuẩn hóa, không gọi API rank
riêng cho từng bài. `per_query` là số ứng viên lấy trước khi lọc; tăng lên (tối đa 50) nếu kết quả
ranked quá ít. `journal_rank_lookup` tra title/ISSN trực tiếp không gọi API.

Dùng `response_format: "json"` khi cần trích DOI/ID để ghi file. Abstract trong kết quả search/citations/expand thường thiếu với bài Elsevier; muốn có abstract để sàng lọc hay kiểm claim thì gọi `paper_get` cho từng bài (với DOI `10.1016/…`, `paper_get` lấy abstract từ Elsevier, `abstractSource: "elsevier"`). Abstract chỉ đủ để kiểm claim nằm trong abstract; claim về con số, bảng, mục cụ thể cần OA PDF hoặc `literature/pdf/`. Nếu không có cả abstract lẫn PDF thì `CANNOT-VERIFY`, không suy đoán nội dung từ tiêu đề.
