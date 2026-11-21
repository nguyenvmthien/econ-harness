---
name: ae-writing
description: Use when drafting or revising economics manuscript prose in English.
---
# Academic prose
## Đoạn văn cho mỗi bảng/hình kết quả (Section 4)
1. **Dẫn bảng**: bảng báo cáo gì, cột nào là đặc tả chính (theo PLAN §8).
2. **Dấu và độ chính xác**: hệ số, SE hoặc CI 95%; với ít cluster nêu cả kết quả CR2/bootstrap.
3. **Độ lớn kinh tế**: β × SD(X) so với mean(Y), hoặc quy ra đơn vị có nghĩa (điểm % NIM, tỷ đồng); số qua `ae_coef(model, term)`; số tự tính (β × SD) bằng `sprintf("%.3f", x)` trong inline R, không gõ tay.
4. **So văn liệu**: lớn hơn/nhỏ hơn bài cụ thể nào, vì sao.
5. **Trỏ tiếp**: robustness/heterogeneity ở đâu.
Kiểm định thất bại hoặc robustness lệch: nói thẳng và nêu hệ quả cho verdict, không bỏ qua. Heterogeneity/mechanism ngoài PLAN gắn "exploratory".
Với giả thuyết sửa theo kết quả, mở đầu minh bạch: “Motivated by the exploratory pattern in [specific models], we consider the retrospective hypothesis that …”. Nêu cơ chế có văn liệu hỗ trợ, kết quả bền/không bền, và phân biệt cùng-mẫu với xác nhận độc lập; không viết như dự đoán đặt ra trước khi ước lượng.

Abstract 150–200 words: question, data, design, result and magnitude, implication. Introduction: motivation → question → data/design → result/magnitude → 2–3 specific contributions → optional roadmap. Hypotheses follow mechanism and prior evidence. Section 3/4 tables follow the five steps above. Say “marginally significant” only for a predeclared threshold and report it. Limitations correspond to weakest verdict pillar. Match verbs to `ae-design`; never claim FE “controls for endogeneity” (it absorbs time-invariant heterogeneity). Avoid “delve”, “crucial”, “pivotal”, “landscape”, unsupported “novel”, unearned “robust”, and “significantly” as a synonym for large. Use direct paragraphs, define terms, avoid inflated transitions. Draft a whole section then reread for evidence and consistency.
