---
name: ae-workflow
description: Use to see what the econ harness provides and where each kind of file goes.
---
# Bản đồ
| Việc | Command | Kết quả |
|---|---|---|
| Tạo project | `$ae-new <slug>` | cây thư mục từ `template/` |
| Tìm văn liệu / thêm trích dẫn | `$ae-lit`, `$ae-cite <DOI>` | `literature/EVIDENCE.csv`, `paper/references.bib` |
| Ghi thiết kế (bắt buộc trước kết quả chính nếu muốn verdict CAUSAL) | `$ae-plan` | `PLAN.md` §1–9 |
| Dữ liệu | `$ae-data` | `data/analysis.rds`, `data/codebook.csv`, `output/logs/data_quality_report.md` |
| Ước lượng + bảng | `$ae-estimate` | `output/tables/*.html|.md|.rds`, `output/figures/*.png` |
| Rà hướng bằng nhiều mô hình/p-value (khám phá) | `$ae-phacking [phạm vi]` | `scratch/ae_phacking_*.R`, `output/logs/phacking/<run-id>.md` + `.rds` |
| Tìm nguồn biến thiên ngoại sinh | `$ae-exogenous [câu hỏi/bối cảnh]` | `output/logs/exogenous/<run-id>.md` |
| Chạy mô hình → viết lại giả thuyết | `$ae-hark [ID...]` | `output/logs/hypothesis_reframe.md`, PLAN §9a/§12, QMD HTML |
| Viết | `$ae-write <mục>` | `paper/manuscript.qmd`, HTML preview |
| Phản biện / bản cuối | `$ae-review`, `$ae-final` | `review/`, `output/paper/manuscript.docx` |

- `$ae-phacking` is a standalone exploratory exception: no `$ae-data` PASS, PLAN, LOG, or codebook prerequisite; those files are optional context. `$ae-estimate` still requires `$ae-data` PASS/PASS WITH CAVEATS. Canonical sample restrictions remain user-controlled; scratch-copy filters need no approval.

## Nhịp nghiên cứu
Vòng lặp nhanh: `$ae-estimate <ID>` chọn mô hình/ID → `$ae-write <mục>` hoặc `Rscript render.R`; render chạy manuscript-only audit và tạo HTML trước. Trước khi PLAN §9 khóa kết quả, mọi kết quả là **EXPLORATORY**. Mốc tái lập: `$ae-review` chạy `run_all.R` và full audit, sau đó `$ae-final` kiểm tra full audit/citation gates và chỉ tạo DOCX sau khi người dùng xem HTML trong Viewer. Light audit không thay thế full reproduction.

### Tìm hướng bằng p-hacking có lưu vết
`$ae-phacking [path/scope/grid]` runs independently on explicit file/directory sources or, absent those, readable `data/analysis.rds` then discovered tables under `data/` (including read-only `data/raw/`). Its broad grid tests Y/X pairs, controls, proxy/2SLS candidates, FE, inference, transforms, subsamples, and a separate ledger of potential exogenous-variation sources.
For each variation lead, distinguish data/source evidence from identifying assumptions and external validation still required. Never call an unverified lead exogenous or causal; explicitly test pre-trends, placebo, sorting/manipulation, spillovers and concurrent shocks where applicable. Preserve all attempts, rank model directions without a cap, label everything EXPLORATORY, and reconcile variation fields and candidate IDs before `$ae-hark`; `$ae-consolidate` remains optional.

`$ae-exogenous` là bước khám phá thiết kế riêng, không chạy hồi quy và không chọn ứng viên theo p-value. Lệnh tìm tối đa ba cơ chế phân bổ có bằng chứng, ưu tiên nguồn sơ cấp; nêu riêng sự kiện đã xác minh, giả định nhận dạng, nguy cơ vi phạm và dữ liệu còn thiếu cho IV/DiD/DiD theo exposure/RDD. PLAN, LOG, codebook và data-quality PASS không phải điều kiện chạy; lệnh không sửa dữ liệu, PLAN hay manuscript.

### HARKing theo kết quả: công khai xuất xứ giả thuyết
Nếu muốn chọn hướng giả thuyết **sau khi xem kết quả**, dùng `$ae-hark`: chạy mô hình chính và robustness thật, so dấu/độ lớn/SE/mẫu/các chẩn đoán, giữ lại cả kết quả null và mâu thuẫn, rồi viết lại giả thuyết trên bằng chứng đủ vững. PLAN §9a giữ lịch sử giả thuyết gốc và bản `origin=post-results`; §12 ghi ngày/lý do. Trong bản thảo gọi là giả thuyết hậu nghiệm mang tính khám phá, không trình bày như giả thuyết đã đăng ký hoặc đã được xác nhận độc lập. Nếu mô hình không ổn định, không ép ra một giả thuyết có hướng.
