@AGENTS.md

# Claude Code / Orca

- Nguồn harness là `harness/` (commands, agents, skills, hook). `.claude/` ở gốc và `template/.claude/` là **file sinh tự động** bởi `node harness/scripts/sync-agents.mjs`; không sửa tay. Sửa `harness/` → chạy lại sync → commit cả hai.
- `/ae-new <slug>` chạy ở gốc workspace. Mọi lệnh nghiên cứu khác chạy **trong project**: mở `projects/<slug>` làm workspace trong Orca (hoặc `cd projects/<slug>` rồi `claude`). Mỗi project mang sẵn `.claude/` copy từ template; cập nhật project cũ bằng `node harness/scripts/sync-agents.mjs --projects`.
- MCP `research_discovery` (tool `mcp__research_discovery__*`) đăng ký ở user scope bởi `harness/setup/setup.mjs`; khoá API chỉ lấy từ biến môi trường, không ghi vào repo.
- `data/raw` được chặn ghi bởi hook `.claude/hooks/ae-raw-guard.mjs` (PreToolUse). Nếu hook chặn nhầm, báo người dùng; không lách bằng script khác.
- Subagent: `ae-*` trong `.claude/agents/`. Khi chạy trong Orca có thể giao phản biện độc lập (`ae-referee`, `ae-citation-check`) cho một agent khác (ví dụ Codex) qua Orca orchestration.
- Kiểm tra sau khi sửa harness: `node harness/tests/raw-guard.test.mjs`, `node harness/scripts/sync-agents.mjs --check`, `Rscript harness/tests/audit-smoke.R`.
