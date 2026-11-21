---
name: ae-methods
description: Use when choosing an estimator, implementing diagnostics, or deciding what belongs in main text versus appendix.
---
# Playbook methods
## Khung Results (nguồn duy nhất cho PLAN §9)
`/ae-plan` chép khung này + playbook phương pháp + bảng giả định của `ae-design` thành các dòng có ID trong PLAN §9. `/ae-estimate` chạy từng ID; `/ae-write results` viết theo đúng thứ tự đó. Mỗi bảng/hình phải trả lời một trong ba câu: hiệu ứng/liên hệ bao nhiêu, có tin được không, vì sao xảy ra; không thì xuống phụ lục.

| Mục | Câu hỏi | Causal (DiD/IV) | Associational (OLS/FE/RE) | Vị trí |
|---|---|---|---|---|
| 3 / 4.1 Mô tả | Mẫu trông thế nào? | Sample flow; N, Mean, SD, Min, P25, Median, P75, Max có đơn vị; balance tiền kỳ treated/control | Sample flow; bảng mô tả; ma trận tương quan | Main |
| 4.2 Kết quả chính | Bao nhiêu? | TWFE benchmark + estimator chính (CS, `cont_did`, 2SLS + first stage) | Baseline 4 cột tiến dần: pooled → + controls → + unit FE → + unit & year FE | Main |
| 4.3 Bằng chứng nhận dạng | Tin được không? | Event study + Wald các lead; anticipation; spillover; HonestDiD (hình chính, bảng phụ lục) | Pooled/FE/RE + F, BP-LM, Hausman robust; `sensemakr` | Main: hình/1 bảng; còn lại Appendix |
| 4.4 Robustness | Phụ thuộc lựa chọn đặc tả? | Một bảng tổng hợp: control group, estimator, mẫu, đo DV | Một bảng tổng hợp: đo DV, winsorize, X trễ, bỏ 2020–2021 | Main tổng hợp, Appendix chi tiết |
| 4.5 Heterogeneity | Mạnh hơn ở đâu? | Theo nhóm định trước (quy mô, sở hữu, vốn) | Tương tác X × nhóm định trước | Main |
| 4.6 Mechanism | Vì sao? | Outcome trung gian theo kênh lý thuyết | Như causal, ngôn ngữ associational | Main |
| Suy luận | SE đúng chưa? | CR1 \| CR2-Satterthwaite \| wild bootstrap; báo G | Như causal; + Driscoll–Kraay khi CSD và T ≥ 20 | Appendix |
| Appendix chung | — | Định nghĩa biến (codebook), kiểm định đặc tả, từng robustness riêng | Như causal; + VIF (mô hình không FE) | Appendix |

Quy tắc bảng: hệ số, SE trong ngoặc ngay dưới, sao 10/5/1%; dòng FE, Controls, Observations, Clusters, R² ghi rõ loại; notes nêu DV + đơn vị, mẫu, loại SE + cấp cluster. Bảng xuất trong script ước lượng bằng `ae_export_table()`/`ae_export_df()` (HTML/MD/RDS, xem Viewer; xem `ae-tables`). Độ lớn kinh tế: β × SD(X) so với mean(Y). Đoạn văn cho từng bảng: `ae-writing`.

Khi `/ae-hark` được gọi sau ước lượng, đánh giá một tín hiệu trên toàn bộ tập kết quả có liên quan: dấu và độ lớn hệ số, CI/SE đúng cấp, N và mẫu, các FE/controls có cơ sở, đo lường thay thế, placebo/diagnostics và cơ chế; nói rõ trường hợp đổi dấu hay mất độ lớn. Mạnh về thống kê trên một cột không đồng nghĩa với kết quả bền, và bền trong cùng mẫu không đồng nghĩa với nhân quả hay kiểm định độc lập.

| Method | Playbook |
|---|---|
| OLS/panel FE/RE | `references/ols-panel.md` |
| Dynamic panel | `references/gmm-dynamic-panel.md` |
| IV | `references/iv.md` |
| 2×2/event study | `references/did-2x2-eventstudy.md` |
| Staggered DiD | `references/did-staggered.md` |
| Continuous dose | `references/did-continuous.md` |
| Inference | `references/inference.md` |

A diagnostic can reject an assumption or change inference; it does not independently prove a causal design.
