---
name: ae-design
description: Use before selecting estimands, causal designs, or the strength of causal language.
---
# Thiết kế và verdict
Classify as causal, associational, or descriptive. State population, treatment contrast, outcome, horizon, and estimand: ATE, ATT, LATE, ATT(d|d), or ACRT. Policy treatment requires source, legal dates, scope, contemporaneous version, and data-unit crosswalk in PLAN §7.

## Rà hướng thăm dò
`/ae-phacking` được phép rà nhiều outcome/biến/đặc tả và xếp hướng theo p-value để **tìm câu hỏi nghiên cứu**, không phải để khẳng định giả thuyết đã đăng ký. Ghi toàn bộ lưới, kết quả null/lỗi và số phép thử; hướng được chọn cần kiểm tra tiếp bằng `/ae-hark`, vẫn là hậu nghiệm trừ khi kiểm định trên dữ liệu thực sự chưa xem kết quả. Không suy nhân quả từ p-value hoặc độ bền thống kê.

## Giả thuyết hình thành sau kết quả (results-first / HARKing minh bạch)
Có thể chạy mô hình trước rồi hình thành hoặc sửa giả thuyết từ các quan hệ bền vững. `/ae-hark` phải chạy mô hình thật, so dấu, độ lớn, CI/SE, mẫu, đặc tả, placebo và cơ chế; một kết quả có p-value nhỏ không đủ. Nếu dấu hoặc độ lớn đổi mạnh, thu hẹp giả thuyết vào bối cảnh được hỗ trợ hoặc ghi không có giả thuyết đủ vững. Phân biệt sự ổn định trong cùng dữ liệu với kiểm định độc lập; FE và robustness không tự xác lập nhân quả.

Giữ nguyên giả thuyết đã khóa (nếu có); thêm phiên bản mới trong PLAN §9a với `origin=post-results`, gắn ID mô hình và bằng chứng trái chiều, ghi thay đổi ở §12. Trong QMD gọi đó là giả thuyết khám phá được thúc đẩy bởi kết quả quan sát, không viết như dự đoán đã có trước phân tích. Mẫu độc lập hoặc holdout thực sự chưa xem outcome mới cho phép kiểm định xác nhận phiên bản mới; nếu không có thì công bố là exploratory. Không bỏ kết quả trái kỳ vọng.

| Variation | Design |
|---|---|
| Exogenous policy timing | DiD; state parallel-trends comparison |
| Valid instrument | IV; defend relevance and exclusion |
| Exogenous threshold | RD; use `rdrobust` |
| No defensible exogenous variation | Associational FE/OLS |

## Giả định → bằng chứng (điền PLAN §6, sinh dòng D/R trong §9)
Mỗi giả định nhận dạng phải có **ít nhất một** kiểm định hoặc lập luận ghi trước khi chạy ước lượng chính. Kiểm định thất bại: vẫn báo, hạ verdict theo cột cuối, không bỏ kiểm định.

| Thiết kế | Giả định | Tối thiểu phải có | Diễn giải đúng | Nếu thất bại |
|---|---|---|---|---|
| DiD | Parallel trends | Event study + Wald đồng thời các lead + HonestDiD (M̄ breakdown) | "no evidence of differential pre-trends"; không viết "parallel trends hold" | Tối đa SUGGESTIVE; HonestDiD thành kết quả chính |
| DiD | No anticipation | Ngày dự thảo/công bố/hiệu lực từ văn bản gốc (PLAN §7); chạy lại sau khi bỏ cửa sổ giữa các mốc | Cửa sổ chọn theo văn bản, không theo dữ liệu | Dời mốc treatment về ngày công bố; ghi §12 |
| DiD | No spillover (SUTVA) | Lập luận kênh lan tỏa cụ thể **hoặc** kiểm định một kênh (bỏ đơn vị đối chứng gần/có quan hệ; đo exposure) | Ngân hàng: liên ngân hàng và cạnh tranh tiền gửi là kênh mặc định phải bàn | Nêu hướng chệch; tối đa SUGGESTIVE |
| DiD | Không đổi thành phần mẫu | Panel cân bằng hoặc bảng vào/ra mẫu theo nhóm | — | Ước lượng trên panel cân bằng làm cột phụ |
| Continuous DiD | Strong PT (khi không có D = 0) | Lập luận riêng + event study theo dose | Chỉ nhận dạng so sánh giữa các dose | Tối đa SUGGESTIVE |
| IV | Relevance | Effective F/KP + AR CI (`ivDiag`) | Không dùng F > 10 máy móc | Báo AR CI làm chính |
| IV | Exclusion | Lập luận bằng lời + falsification trên outcome tiền kỳ | Overid test không chứng minh exclusion | Tối đa SUGGESTIVE |
| IV | Monotonicity/independence | Lập luận + balance của z trên covariate tiền kỳ | Ước lượng là LATE của compliers | — |
| FE/OLS (associational) | Không có confounder thay đổi theo thời gian | `sensemakr` (robustness value, bound theo control mạnh nhất) | Chỉ đo độ nhạy, không xác lập nhân quả | Giữ ASSOCIATIONAL; nêu trong limitations |
| FE/OLS | Không nhân quả ngược / đồng thời | X trễ t−1; lập luận thời điểm đo | Trễ biến không giải quyết nội sinh | Nêu trong limitations |
| Mọi thiết kế | Suy luận đúng | Số cluster; khi G < 50: CR1 + CR2-Satterthwaite + wild cluster bootstrap (`inference.md`) | Đổi SE không phải robustness nhận dạng | Kết luận theo thủ tục thận trọng nhất |

Chi tiết hàm R và vị trí bảng: playbook tương ứng trong `ae-methods`.

| Verdict | Conditions / permitted prose | Prohibited prose |
|---|---|---|
| CAUSAL | credible exogenous variation, locked design and diagnostics, no fatal threat; “increases”, “reduces”, “the effect of” | “proves” |
| SUGGESTIVE | design plausible but at least one pillar weak; “consistent with a causal effect”, “suggests”, “points to” | “causes”, “caused”, “proves”, “confirms”, “demonstrates that” |
| ASSOCIATIONAL | no credible exogenous variation; “is associated with”, “correlates with”, “predicts” | “effect of”, “impact”, “influence”, “determinant”, “drives”, “leads to”, “causes”, “proves”, “confirms” |

A non-significant pretrend test is not proof of parallel trends. Statistical significance does not identify causality.
