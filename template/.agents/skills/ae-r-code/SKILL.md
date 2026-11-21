---
name: ae-r-code
description: Use when writing or editing R estimation scripts in an econ project.
---
# Quy ước R
- Script tự do: đặt tên, thứ tự, số lượng tùy bài; code thử nghiệm được phép. `R/01_build.R` dựng `data/analysis.rds`; script ước lượng đọc thẳng bằng `df <- readRDS(here::here("data/analysis.rds"))` (hoặc file trung gian khi hợp lý). Đọc/ghi file viết thẳng `readRDS`/`saveRDS`/`ggsave` để người đọc thấy file nào vào, file nào ra; không bọc thêm hàm.
- Header ngắn: Purpose / Output. Dùng `here::here()`; không `setwd`, `rm(list = ls())`, đường dẫn tuyệt đối, `install.packages` trong script.
- Gói chung trong `R/00_packages.R`; gói theo phương pháp `library()` ở đầu script dùng nó (bắt buộc với `did` để modelsummary nhận object).
- `feols` luôn có `vcov` tường minh (`vcov = ~bank_id`); không truyền thì fixest tự cluster theo FE đầu tiên.
- Kết quả: xuất bảng bằng `ae_export_table()`/`ae_export_desc()` ngay trong script (xem `ae-tables`); lưu model cần dùng lại (bảng khác, số trong prose) bằng `saveRDS(list(m1 = m1, ...), here::here("output/models/<name>.rds"))`; hình bằng `ggsave(here::here("output/figures/<name>.png"), p, width = 6.5, height = 4, dpi = 300)`.
- Đặt seed (`set.seed(SEED)`) trước bootstrap/mô phỏng.
- Chạy lại toàn bộ khi cần bằng `Rscript run_all.R` (sửa danh sách script trong file nếu đổi tên).
