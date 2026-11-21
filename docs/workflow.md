# Quy trình làm việc

Tài liệu này giải thích từng bước mà README chỉ liệt kê. Luật bắt buộc cho agent nằm ở `AGENTS.md`; nếu có chỗ khác nhau thì `AGENTS.md` được ưu tiên.

## Workspace và project

- Lệnh `/ae-new <slug>` chạy ở gốc workspace. Nó chép `template/` sang `projects/<slug>`, khởi tạo Git và `renv`.
- Mọi lệnh khác chạy **bên trong project**: trong Orca, thêm `projects/<slug>` thành một repository riêng; hoặc `cd projects/<slug>` rồi chạy `claude`.
- Mỗi project mang sẵn `.claude/` của nó. Sau khi cập nhật harness, chạy `node harness/scripts/sync-agents.mjs --projects` ở gốc để cập nhật project cũ.

## Các bước

### Tài liệu: `/ae-lit`, `/ae-cite`

`/ae-lit` dùng MCP `research_discovery` để tìm và đọc tài liệu, ghi bằng chứng vào `literature/EVIDENCE.csv`.

Chỉ thêm tài liệu vào `paper/references.bib` bằng `/ae-cite <DOI>`. Trạng thái kiểm tra của từng trích dẫn ghi ở `literature/citation_checks.csv`; ở bước `/ae-review`, subagent `ae-citation-check` kiểm lại độc lập mọi câu có trích dẫn trong bản thảo.

### Thiết kế: `/ae-plan`, `/ae-exogenous`

`/ae-plan` viết `PLAN.md`: câu hỏi, giả thuyết, dữ liệu, đặc tả mô hình. Kết quả nào chạy **trước khi** dòng PLAN §9 tương ứng được viết thì bị gắn nhãn EXPLORATORY và không được dùng để kết luận nhân quả.

`/ae-exogenous [câu hỏi]` tìm nguồn biến thiên ngoại sinh trước khi chọn thiết kế:

- xác định estimand, tìm tối đa ba cơ chế phân bổ có tài liệu;
- đối chiếu chi tiết chính sách hay sự kiện với nguồn gốc;
- thử thách giả định của IV, DiD, DiD liên tục, RDD.

Lệnh này không chạy hồi quy, không xếp hạng theo p-value, không sửa dữ liệu, PLAN hay bản thảo. Báo cáo lưu ở `output/logs/exogenous/`.

### Dữ liệu và ước lượng: `/ae-data`, `/ae-estimate`, `/ae-consolidate`

- Dữ liệu thô vào `data/raw` qua `R/00_download.R` hoặc người dùng tự đặt file, rồi đăng ký bằng `ae_register_raw()`. Agent không bao giờ sửa file thô; làm sạch luôn bằng code.
- `R/01_build.R` tạo `data/analysis.rds`, định nghĩa biến ở `data/codebook.csv`.
- Code ước lượng viết tự do, chạy theo thứ tự nào cũng được. Luôn đặt `vcov` rõ ràng trong `feols`.
- `Rscript run_all.R` chạy lại toàn bộ pipeline theo thứ tự script.

| Script | Kết quả |
|---|---|
| `R/01_build.R` | `data/analysis.rds` |
| `R/02_describe.R` | thống kê mô tả |
| `R/03_main.R` | mô hình chính |
| `R/04_robustness.R` | kiểm tra độ vững |
| `R/05_extensions.R` | mở rộng |
| `R/99_audit.R` | `output/logs/audit.md` (đầy đủ) hoặc `audit_manuscript.md` (chỉ bản thảo) |

### Khám phá: `/ae-phacking`, `/ae-hark`

Hai lệnh này dành cho giai đoạn tìm hướng nghiên cứu. Mọi kết quả từ đây đều là **EXPLORATORY**.

`/ae-phacking [đường dẫn/phạm vi/lưới]` rà rộng trên dữ liệu đọc được mà không cần `/ae-data`, PLAN hay codebook:

- thử các cặp Y/X, biến kiểm soát, proxy, bộ ba IV cho 2SLS, FE, cách tính sai số chuẩn, phép biến đổi, mẫu con;
- liệt kê riêng các nguồn biến thiên tiềm năng (chính sách, cú sốc, ngưỡng), tách bằng chứng quan sát được khỏi giả định;
- giữ lại toàn bộ lưới, kể cả lần chạy lỗi và kết quả null. Không giới hạn số phép thử.

Không gọi một nguồn biến thiên là ngoại sinh khi chưa kiểm chứng độc lập; IV có liên quan mạnh chưa có nghĩa là hợp lệ.

`/ae-hark [ID...]` chạy mô hình thật cùng các kiểm tra độ vững, so dấu, độ lớn, SE/CI, mẫu và chẩn đoán, ghi ma trận bằng chứng vào `output/logs/hypothesis_reframe.md`. Giả thuyết sửa lại được thêm vào PLAN §9a với `origin=post-results`; giả thuyết cũ và kết quả trái chiều vẫn giữ nguyên. Độ vững trên cùng một mẫu không phải là kiểm định độc lập hay bằng chứng nhân quả.

### Viết và phản biện: `/ae-write`, `/ae-review`, `/ae-final`

- `/ae-write <mục>` viết một phần bản thảo bằng tiếng Anh, rồi render HTML để xem.
- `/ae-review` chạy lại toàn bộ pipeline, audit đầy đủ, và giao subagent `ae-referee` phản biện.
- `/ae-final [style]` kiểm tra audit và trích dẫn, rồi mới xuất DOCX, sau khi người dùng đã xem HTML.

## Bảng kết quả

Bảng luôn được dựng trong R từ object mô hình, bằng `modelsummary`, `datasummary` hoặc `fixest::etable`. Không chép hệ số ra CSV rồi dựng bảng bằng tay.

```r
ae_export_table(list("(1)" = m1, "(2)" = m2), "T2_baseline")
```

Lệnh trên ghi ba file vào `output/tables/`:

- `T2_baseline.html`: xem trong Viewer của RStudio (tự mở nếu chạy trong RStudio);
- `T2_baseline.md`: bản Markdown;
- `T2_baseline.rds`: để chèn vào bản thảo.

Loại sai số chuẩn và số cluster được đọc từ object mô hình. Mở lại một bảng bằng `ae_view_table("T2_baseline")`. Cần gửi lẻ một bảng Word thì thêm `docx = TRUE`.

## Render bản thảo

Bản thảo là `paper/manuscript.qmd`; chèn bảng bằng `ae_table("T2_baseline")`.

**Luôn xem HTML trước.** DOCX chỉ xuất ở bước cuối.

| Lệnh | Tác dụng |
|---|---|
| `Rscript render.R` | Render HTML, mở trong Viewer |
| `Rscript render.R docx` | Render HTML, rồi DOCX bản cuối |
| `Rscript render.R html run` | Chạy lại toàn bộ mô hình trước khi render |

Trong RStudio: mở `render.R`, chỉnh `DOCX` hoặc `RUN_MODELS` ở đầu file, rồi Source (Ctrl+Shift+S). Nút Render của RStudio cũng ra HTML nhưng bỏ qua bước kiểm tra bảng còn thiếu; `render.R` thì dừng nếu bản thảo gọi một bảng chưa được xuất.

Style Word nằm ở `paper/reference.docx`; chỉnh một lần trong Word.

## Thư mục trong một project

| Thư mục | Nội dung |
|---|---|
| `data/raw` | Dữ liệu nguồn, bất biến |
| `data/analysis.rds`, `data/codebook.csv` | Dữ liệu phân tích và định nghĩa biến |
| `R/` | Script theo thứ tự |
| `output/` | Bảng, hình, mô hình, log |
| `paper/` | Bản thảo |
| `literature/` | Bằng chứng và kết quả kiểm trích dẫn |
| `scratch/` | Thử nghiệm |

Hướng dẫn cho từng phương pháp (OLS/panel, IV, DiD, GMM, suy diễn) nằm ở `harness/skills/ae-methods/references/`.
