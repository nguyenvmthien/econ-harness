---
name: ae-tables
description: Use when producing regression, descriptive, or diagnostic tables from R results; tables are built by modelsummary from fitted models inside the estimation script and exported as HTML/Markdown (DOCX only for the final manuscript).
---
# Bảng kết quả: dựng bằng package, xuất trong script

## Nguyên tắc
- Bảng hồi quy **luôn** dựng từ object mô hình đã ước lượng bằng package chuẩn: `modelsummary` (chính), `fixest::etable` (bảng fixest nhanh / LaTeX), `modelsummary::datasummary*` (mô tả, chẩn đoán).
- **Cấm**: ghi hệ số/SE ra CSV, txt, Excel rồi dựng bảng lại; gõ số vào bảng; dựng bảng từ số lẻ lúc render bản thảo.
- Bảng được xuất **ngay trong script ước lượng**: `output/tables/<name>.html` (mở trong Viewer RStudio/trình duyệt), `<name>.md` (Markdown, đọc nhanh/diff được) và `<name>.rds` (đối tượng tinytable + flextable để chèn bản thảo). Chạy trong RStudio thì bảng tự hiện ở Viewer.
- **Không ghi DOCX khi chạy script** (chậm hơn HTML ~10 lần). Bảng Word chỉ sinh khi render bản thảo `--to docx` ở bước cuối, hoặc khi cần gửi lẻ một bảng: thêm `docx = TRUE`. Thêm `tex = TRUE` nếu cần `.tex`.
- Loại SE và số cluster **đọc từ object** (fixest lưu `vcov_type` và `G`; did lưu `clustervars`) — không khai tay.

## Quy tắc Viewer trước
- Mọi bảng và bản thảo được xem ở **Viewer của RStudio** (HTML) trước tiên; DOCX chỉ làm khi người dùng yêu cầu sau khi đã xem Viewer.
- Chạy script trong RStudio: `ae_export_table()` tự mở bảng vừa xuất trong Viewer. Mở lại bất kỳ bảng nào: `ae_view_table("T3_main")`.
- Bản thảo: `render.R` luôn render HTML và mở Viewer trước; `DOCX <- TRUE` (hoặc `Rscript render.R docx`) chỉ thêm DOCX sau bước đó. Mọi `render.R` phải có `here::i_am("render.R")` trước `here::here()`; thiếu dòng này `here` lấy nhầm gốc Git của workspace (`<ECON_ROOT>`).
- Viewer chỉ đọc file trong thư mục tạm của phiên, nên `ae_view()` chép HTML vào `tempdir()`; HTML phải tự chứa (bảng: `theme_html(portable = TRUE)`; bản thảo: `embed-resources: true`).
- Agent chạy `Rscript` (không có Viewer): sau khi xuất bảng/render, báo cho người dùng đúng dòng lệnh mở Viewer.

## Hàm (template `R/functions.R`)
| Hàm | Dùng cho |
|---|---|
| `ae_export_table(models, name, title, notes, coef_map, gof_map, add_rows, tex, ...)` | Bảng hồi quy. `models` = list có tên cột; list các list có tên = Panel A/B (`shape = "rbind"`). `...` chuyển thẳng vào `modelsummary()` |
| `ae_export_desc(df, vars, name, title, notes)` | Bảng mô tả N, Mean, SD, Min, P25, Median, P75, Max; nhãn từ `data/codebook.csv` |
| `ae_export_df(df, name, title, notes, fmt)` | Bảng chẩn đoán từ data frame do package trả về (Bacon, HonestDiD, bootstrap, cohort) qua `datasummary_df` |
| `ae_as_model(tidy, glance)` | Estimator trả data frame thay vì object (`didimputation`, HonestDiD...) → định dạng `modelsummary_list` chính thức của modelsummary |
| `ae_view(file)`, `ae_view_table(name)` | Mở HTML trong Viewer (ngoài RStudio: trình duyệt) |
| `ae_table(name)` | Trong `manuscript.qmd`: HTML → tinytable; DOCX → bảng Word gốc (flextable) |
| `ae_coef(model, term, stat, digits)` | Số trong prose từ model object (`estimate`, `std.error`, `p.value`, `conf.low`...) |
| `ae_event_plot(df, ref, xlab, ylab)` | Hình event study từ data frame `event_time, estimate, conf.low, conf.high` (+ `estimator`) |

Mặc định: hệ số 3 chữ số, SE trong ngoặc ngay dưới, sao 10/5/1%, font Times New Roman 10. Dòng FE tự đặt tên `<nhãn codebook> FE`; thứ tự gof: FE → Observations → Units → R² → Adj. R² → Within R² → Std. errors → Clusters.

## Estimator ngoài fixest
- `did::att_gt`/`aggte`: cần `library(did)` trong script (method `tidy` chỉ đăng ký khi package được nạp). `functions.R` bổ sung p-value (xấp xỉ chuẩn, cùng cơ sở với CI điểm của `did`) và đổi `nobs` thành số unit-period để khớp cột fixest.
- `contdid::cont_did`: `functions.R` định nghĩa `tidy.dose_obj`/`glance.dose_obj` → hai dòng `ATT (overall)`, `ACRT (overall)`.
- `fixest::sunab`: dùng `summary(m, agg = "ATT")` cho cột ATT tổng.
- `didimputation`, `HonestDiD`, `fwildclusterboot`, `clubSandwich`: kết quả là data frame/list → `ae_as_model()` hoặc `modelsummary::datasummary_df()` cho bảng chẩn đoán.
- Gói khác không có `broom::tidy`: viết `tidy.<class>`/`glance.<class>` (cách modelsummary hướng dẫn), không chép số.

## Mẫu
```r
library(fixest)
m1 <- feols(roa ~ treat_post | bank_id + year, data = df, vcov = ~bank_id)
m2 <- feols(roa ~ treat_post + size + lev | bank_id + year, data = df, vcov = ~bank_id)
ae_export_table(list("(1)" = m1, "(2)" = m2), "T2_baseline",
  coef_map = c(treat_post = "Treated x Post", size = "Bank size", lev = "Leverage"),
  title = "Baseline results",
  notes = c("Dependent variable: ROA (%).", "Standard errors clustered by bank in parentheses.",
            "* p<0.10, ** p<0.05, *** p<0.01."))
```
Panel: `ae_export_table(list("Panel A: ROA" = list("(1)" = a1, "(2)" = a2), "Panel B: ROE" = list("(1)" = b1, "(2)" = b2)), "T3_panels")`.

## Notes bắt buộc
DV + đơn vị; mẫu; estimator; loại SE + cấp cluster; chú giải sao. Mẫu: "Notes: This table reports … The dependent variable is … measured in …. Standard errors clustered at the … level are in parentheses. *, **, and *** denote significance at the 10%, 5%, and 1% levels."

## Hình
`ggplot2` → `ggsave(here::here("output/figures/<name>.png"), p, width = 6.5, height = 4, dpi = 300)`; CI 95%; trục có đơn vị; đọc được khi in trắng đen. Event study: `ae_event_plot()`.

## Bản thảo
Chunk `#| label: tbl-...` + `#| tbl-cap:` gọi `ae_table("<name>")`; số trong prose qua `ae_coef(model, term)` với model đọc ở chunk setup bằng `readRDS()`. Xem: `render.R` (Source trong RStudio hoặc `Rscript render.R`) → HTML mở trong Viewer. Bản cuối: `DOCX <- TRUE` / `Rscript render.R docx` (vẫn render HTML trước).

## Kiểm tra sau khi xuất
Đọc `output/tables/<name>.md` và đối chiếu với `modelsummary::get_estimates(model)`. Không đánh giá được bố cục trang bằng code → báo `VISUAL NOT CHECKED`.
