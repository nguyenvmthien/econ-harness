# Cài đặt econ harness trên Windows (Orca + Claude Code)

> Quy trình: **dựng trên Mac → push GitHub → clone trên Windows → chạy `setup-windows.ps1`**.
> Agent chính: **Claude Code** chạy trong **Orca**. Codex/opencode dùng được qua `AGENTS.md`; omp là tuỳ chọn.
> Repo không chứa đường dẫn tuyệt đối và không chứa khoá API.

---

## 0. Tổng quan những gì script làm

| Bước | Ai làm | Ở đâu |
|---|---|---|
| Cài Git, Node LTS, R, RStudio, Quarto, Pandoc, Python, Rtools (winget) | `setup-windows.ps1` | §2 |
| Thêm `R\bin` vào PATH (installer R không tự làm) | `setup-windows.ps1` | §2 |
| Cài Claude Code (hỏi trước) | `setup-windows.ps1` | §2 |
| Lưu `ECON_ROOT`, `OPENALEX_EMAIL`, `SEMANTIC_SCHOLAR_API_KEY`, `ELSEVIER_API_KEY` thành biến môi trường **user** | `setup-windows.ps1` | §2 |
| Sinh `.claude/` từ `harness/`, build MCP, tạo `reference.docx`, cài gói R, đăng ký MCP, kiểm chứng | `harness/setup/setup.mjs` | §2 |
| Thêm workspace vào Orca | script (nếu có CLI `orca`) hoặc làm tay | §3 |

Script chạy lại an toàn bao nhiêu lần cũng được.

---

## 1. Trên Mac: đưa repo lên GitHub (làm một lần)

```bash
cd econ-harness
git status                 # kiểm tra không có file lạ / khoá
gh repo create <ten-repo> --private --source . --push
# hoặc: tạo repo trống trên github.com rồi
# git remote add origin git@github.com:<user>/<ten-repo>.git && git push -u origin main
```

Nên để **private**. Không commit: `projects/`, `data_hub/`, `node_modules/`, `dist/`, `.omp/config.yml`, `.claude/settings.local.json` (đã nằm trong `.gitignore`).

---

## 2. Trên Windows: clone và chạy setup

### 2.1 Chuẩn bị

- Windows 10/11, có **winget** (`winget --version`; thiếu thì cài "App Installer" từ Microsoft Store).
- Cần Git để clone. Nếu chưa có:
  ```powershell
  winget install --id Git.Git -e --source winget
  ```
  Sau đó **mở PowerShell mới**.
- Chọn thư mục **ngắn, không dấu cách, không tiếng Việt, không nằm trong OneDrive**, ví dụ `C:\econ`. Đường dẫn dài hoặc có OneDrive hay làm hỏng `renv` và Quarto.

### 2.2 Clone

```powershell
git clone https://github.com/<user>/<ten-repo>.git C:\econ
cd C:\econ
```

### 2.3 Chạy setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

Script sẽ:
1. Cài phần mềm còn thiếu bằng winget.
2. Hỏi có cài Claude Code không.
3. Hỏi `OPENALEX_EMAIL` (nên có), `SEMANTIC_SCHOLAR_API_KEY`, `ELSEVIER_API_KEY` (Enter để bỏ qua).
4. Gọi `node harness\setup\setup.mjs`, in bảng `PASS / WARN / FAIL / SKIP`.

Lần đầu mất khoảng **15–40 phút**, phần lớn là cài gói R.

Tuỳ chọn:

| Cờ | Tác dụng |
|---|---|
| `-SkipInstall` | Không cài phần mềm (máy đã có đủ) |
| `-SkipR` | Không cài gói R |
| `-Offline` | Bỏ test MCP cần mạng |
| `-NoPrompt` | Không hỏi; dùng biến môi trường có sẵn |

**Nếu có dòng FAIL:** sửa theo §6, **mở PowerShell mới** (để PATH cập nhật), chạy lại script.

### 2.4 Đăng nhập Claude Code

```powershell
claude
```

Đăng nhập theo hướng dẫn trên màn hình, rồi thoát (`/exit`). Claude Code trên Windows dùng **Git Bash** (đi kèm Git) để chạy lệnh và hook. Nếu nó báo không tìm thấy bash, đặt biến `CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\bin\bash.exe`.

### 2.5 Chỉnh style Word (một lần)

Mở `template\paper\reference.docx` bằng Word, chỉnh font/heading/bảng, lưu lại, rồi commit:

```powershell
git add template/paper/reference.docx
git commit -m "style: reference.docx"
```

---

## 3. Orca

1. Cài Orca từ trang chính thức, mở app.
2. **Add repository** → chọn `C:\econ` (script đã tự thêm nếu có CLI `orca`).
3. Trong cài đặt agent của Orca, đặt **Claude** làm agent mặc định.
4. Mở agent mới trong workspace `econ` rồi chạy `/ae-new <slug>` (ví dụ `/ae-new fdi_vn`).
5. **Add repository** → chọn `C:\econ\projects\<slug>`. Mỗi project là một repo Git riêng và đã có sẵn `.claude/`.
6. Mọi lệnh khác (`/ae-lit`, `/ae-plan`, `/ae-data`, `/ae-estimate`, `/ae-write`, `/ae-review`, `/ae-final`...) chạy trong workspace của **project**.

**Lưu ý về worktree của Orca:**
- Với project nghiên cứu, làm trực tiếp trên bản checkout chính.
- Worktree mới **không** mang theo những gì Git không theo dõi hoặc đã bỏ qua: thư viện `renv`, `output/`, và dữ liệu lớn nếu bạn không commit. Vì vậy mô hình chạy trong worktree sẽ thiếu dữ liệu.
- Chỉ dùng worktree cho việc sửa `harness/` ở repo `econ`.

**Phản biện độc lập bằng agent khác (tuỳ chọn):** sau `/ae-write`, có thể mở một agent Codex trong cùng project và nhờ "đọc `.claude/agents/ae-referee.md` rồi phản biện theo đúng hợp đồng đó". Một model khác chấm bài sẽ khách quan hơn việc model tự review.

---

## 4. Agent khác (tuỳ chọn)

| Agent | Cách dùng harness |
|---|---|
| **Claude Code** | Đầy đủ: `/ae-*`, subagent, skill, hook raw-guard, MCP |
| **Codex** | Đọc `AGENTS.md`. Setup đã đăng ký MCP nếu có lệnh `codex`. Không có slash command `/ae-*`: dặn "làm theo `.claude/commands/ae-lit.md`". **Không có hook raw-guard**, nên chỉ dựa vào luật trong `AGENTS.md` |
| **omp** | `powershell -ExecutionPolicy Bypass -File harness\install.ps1`. `.omp/config.yml` đã được setup sinh. Đăng ký MCP trong `%USERPROFILE%\.omp\agent\mcp.json` dưới khoá `"mcpServers"` |

Ví dụ `mcp.json` cho omp (giữ các server khác):

```json
{
  "mcpServers": {
    "research_discovery": {
      "command": "node",
      "args": ["C:/econ/harness/mcp/research-discovery/dist/index.js"],
      "env": { "OPENALEX_EMAIL": "<email>" }
    }
  }
}
```

---

## 5. Kiểm chứng sau cài đặt (checklist)

`setup.mjs` đã tự chạy mục **A**. Mục **B** làm tay một lần.

**A. Tự động** (chạy lại bất cứ lúc nào: `node harness\setup\setup.mjs --skip-r`)
- [ ] `node`, `git`, `Rscript`, `quarto`, `pandoc` đều PASS
- [ ] `MCP build (dist/index.js)` PASS
- [ ] `R packages` PASS (xem thêm WARN của nhóm gói phương pháp)
- [ ] `register MCP for Claude Code` PASS
- [ ] `raw-guard hook tests` PASS
- [ ] `.claude/ in sync with harness/` PASS
- [ ] `audit-smoke.R` PASS
- [ ] `MCP protocol test` PASS

**B. Trong Claude Code / Orca** (mở agent ở `C:\econ`)
- [ ] `/mcp` liệt kê `research_discovery` ở trạng thái connected
- [ ] Gõ `/ae-` thấy đủ 13 lệnh
- [ ] `/agents` thấy 7 agent `ae-*`
- [ ] `/ae-new smoke` tạo `projects\smoke` có `.git`, `renv.lock`, `.claude\`
- [ ] Trong `projects\smoke`: `Rscript render.R` sinh `output\paper\manuscript.html`
- [ ] Nhờ agent "ghi file `data/raw/x.csv`" → bị chặn với thông báo `ae-raw-guard`
- [ ] Xoá `projects\smoke` khi xong

---

## 6. Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `Rscript` not recognized | Mở PowerShell mới. Nếu vẫn lỗi: thêm `C:\Program Files\R\R-4.x.x\bin` vào PATH của user |
| `node`/`quarto`/`pandoc` not recognized ngay sau khi cài | Mở PowerShell **mới** rồi chạy lại script |
| `winget could not install RProject.Rtools` | Tải Rtools46 tại https://cran.r-project.org/bin/windows/Rtools/, tick "Add to PATH" |
| Gói phương pháp (`fwildclusterboot`, `HonestDiD`, `contdid`...) WARN | Cài Rtools, mở PowerShell mới, chạy `Rscript harness\setup\install-packages.R` |
| `MCP protocol test` FAIL | Kiểm tra mạng / proxy; đặt `OPENALEX_EMAIL`; chạy lại `node scripts\protocol-test.mjs` trong `harness\mcp\research-discovery` |
| `/mcp` không thấy `research_discovery` | `claude mcp list`; nếu thiếu, chạy lại `node harness\setup\setup.mjs --skip-r` |
| Hook không chặn ghi `data/raw` | Kiểm tra `.claude\settings.json` có `PreToolUse`; chạy `node harness\tests\raw-guard.test.mjs`; Claude Code cần Git Bash (§2.4) |
| `/ae-*` không có trong project cũ | `node harness\scripts\sync-agents.mjs --projects` ở `C:\econ` |
| `renv::init` lỗi trong `/ae-new` | Thường do đường dẫn có dấu cách, OneDrive hoặc thiếu Rtools; dời repo về `C:\econ` |
| Dòng xuống CRLF làm diff rối | Repo có `.gitattributes` ép LF; nếu đã clone trước đó: `git add --renormalize .` |

---

## 7. Cập nhật harness về sau

1. Sửa **nguồn** trong `harness/` (commands, agents, skills, `harness/claude/`). Không sửa `.claude/`.
2. Chạy `node harness/scripts/sync-agents.mjs` (thêm `--projects` để cập nhật project đang có).
3. Kiểm tra:
   ```powershell
   node harness\tests\raw-guard.test.mjs
   node harness\scripts\sync-agents.mjs --check
   Rscript harness\tests\audit-smoke.R
   ```
4. Commit, push. Máy kia chạy `git pull`, rồi `node harness\setup\setup.mjs --skip-r` nếu MCP thay đổi.

---

## 8. ClaudeR (tuỳ chọn: agent thao tác trực tiếp trong RStudio)

Chỉ cần nếu muốn agent chạy code, xem plot hay đọc object **trong phiên RStudio đang mở**.

1. Cài `uv`:
   ```powershell
   winget install --id astral-sh.uv -e
   ```
2. Cài ClaudeR trong RStudio:
   ```r
   install.packages("remotes")
   remotes::install_github("IMNMV/ClaudeR")
   ```
3. Cấu hình kết nối với Claude Code theo README của repo `IMNMV/ClaudeR`. Lệnh cấu hình thay đổi theo phiên bản, nên kiểm tra README trước khi chạy.
4. Khi muốn **làm tay**: trong addin bấm **Stop Server**, hoặc gỡ bằng `claude mcp remove <tên>`. Biên bản họp đã lưu ý: phải ngắt addin thì mới thao tác tay được.
