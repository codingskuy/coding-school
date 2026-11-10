# Rencana Implementasi: CodingSchool Multi-Platform

> Status: **Fase 0–6 selesai, Fase 7 sedang berjalan** · Dibuat: 2026-11-10 · Basis kode: v2.2.2 (`a24fd8d`)
> Target rilis: **v3.0.0**

## 1. Tujuan

Membuat CodingSchool (Teacher + Coach) bisa berjalan di beberapa agent harness selain OpenCode:

*(Diperbarui setelah Fase 0 — lihat Gerbang Fase 0 untuk bukti.)*

| Platform | Mekanisme tool | Mekanisme agent | Penegakan claim gate |
|---|---|---|---|
| OpenCode (sudah ada) | `tool()` plugin | hook `config` | hook `permission.ask` |
| Claude Code | MCP server (stdio) di `.mcp.json` plugin | `agents/*.md` + `claude --agent teacher\|coach` | hook `PreToolUse` (exit 2) → `gate-check` |
| Pi agent (`@earendil-works/pi-coding-agent` ≥ 1.0) | MCP server (Pi punya MCP bawaan sejak 0.87.1) | extension kecil: `/teacher` `/coach` via `before_agent_start` + `setActiveTools` | extension: event `tool_call` → `{ block: true }` |
| DeepSeek Harness (`@deepseek-ai/dsh` 0.2.2-rc.1, developer preview) — **Web** (preset); Desktop/headless belum | MCP server (`dsh-mcp-client`, di dalam preset) | agent preset (patch Cordis, `dsh web --patch`) | Teacher: preset tanpa tool penulis; Coach: `dsh-hooks-claude-code` → `gate-check --persona coach` |
| Harness lain ber-MCP (Codewhale, Cursor, Codex, dll.) | MCP server | MCP prompts `teacher` / `coach` | hook bila ada (Codewhale: `tool_call_before` exit 2); selain itu **hanya prompt** |

**Konsekuensi:** server MCP menjadi adapter universal. Adapter khusus platform hanya mengurus persona dan claim gate.

### 1.1 Konsep Inti: Persona (= "agent" / "mode" di produk lain)

CodingSchool memakai pendekatan **custom agent**: Teacher dan Coach adalah dua *persona* dengan prompt, akses tool, dan aturan menulis file masing-masing. Setiap produk menamai konsep ini berbeda. Agar desain tidak terikat ke istilah satu produk, kode dan dokumen ini memakai istilah netral **Persona**.

**Definisi Persona** (satu sumber kebenaran, di `src/personas/`):

| Atribut | Teacher | Coach |
|---|---|---|
| `id` | `teacher` | `coach` |
| `systemPrompt` | `renderPrompt("teacher", platform)` | `renderPrompt("coach", platform)` |
| `csTools` (tool `cs_*` yang boleh dipakai) | semua | semua |
| `writePolicy` | `never` — tidak pernah menulis file | `claim-gated` — hanya saat ada claim terbuka |
| `handoffTo` | `coach` (saat proyek siap) | `teacher` (saat proyek selesai) |
| `default` | ya | tidak |

**Pemetaan istilah dan mekanisme per platform:**

| Platform | Istilah di produk | Cara mendaftarkan persona | Cara pengguna berpindah persona | Penegakan `writePolicy` |
|---|---|---|---|---|
| OpenCode | *primary agent* | hook `config` → `config.agent[id]` | Tab / dropdown agent, `opencode --agent coach` | `permission.ask` |
| Claude Code | *agent* (custom agent / subagent) | `agents/<id>.md` di plugin | sesi baru: `claude --agent coach` (F0-02) | `tools:` tanpa Write + hook `PreToolUse` |
| Pi | *mode* / *preset* | extension: `registerCommand` + `before_agent_start` | `/teacher`, `/coach` di tengah sesi | `setActiveTools` + `tool_call` block |
| DeepSeek Harness (Web) | *agent preset* | patch Cordis berisi 2 baris `@deepseek-ai/dsh-agent-preset` (ditulis `setup --platform dsh`) | sesi baru, pilih preset di mode picker (preset terkunci setelah sesi dimulai) | Teacher tanpa tool penulis; Coach: hook bridge di dalam preset Coach |
| Harness MCP generik | *prompt* | MCP prompts `teacher`, `coach` | memilih prompt di UI harness | hanya prompt (tidak ditegakkan) |

**Aturan penamaan:**
- Di kode, tipe, dan nama file: selalu **persona** (`Persona`, `src/personas/`, `renderPrompt(personaId, platform)`).
- Di teks yang dilihat siswa: pakai istilah produknya ("pindah ke agent **Coach**" di OpenCode/Claude Code, "pindah ke mode **Coach**" di Pi/DSH). Teks ini diambil dari `platform-hints.ts`, tidak ditulis langsung di prompt.
- Nama `teacher` / `coach` tetap sama di semua platform, supaya data di `.codingschool/` dan kebiasaan siswa tetap konsisten.

Bila ada platform yang tidak bisa menegakkan `writePolicy`, matriks fitur di README wajib menandainya *prompt-only*.

**Prinsip:**
1. Logika inti (`src/*.ts` selain `index.ts`/`tui.ts`) **tidak berubah perilaku**.
2. Definisi 27 tool `cs_*` ditulis **sekali**; tiap platform hanya adapter tipis.
3. State tetap di `.codingschool/` (file JSON), sehingga satu siswa bisa berpindah platform tanpa kehilangan progres.
4. Setiap fase ditutup dengan **Gerbang Fase** (validasi, audit, test, log issue). Fase berikutnya tidak dimulai sebelum issue berseverity *High* di fase sebelumnya berstatus *Closed*.

## 2. Kondisi Saat Ini (Baseline)

| Area | Lokasi | Keterikatan ke OpenCode |
|---|---|---|
| 27 tool `cs_*` | `src/index.ts:84–940` | `tool()` + `tool.schema` (zod) dari `@opencode-ai/plugin` |
| Registrasi agent Teacher/Coach | `src/index.ts:944–976` | hook `config` |
| Claim gate | `src/index.ts:982–1000`, `src/coach-gate.ts:58` (`hasOpenClaim`) | hook `permission.ask` |
| System prompt Teacher/Coach | `src/index.ts:1004`, `src/index.ts:1150` | berisi teks "`opencode --agent coach`" |
| Sidebar TUI | `src/tui.ts`, `src/sidebar/*` | OpenTUI — **khusus OpenCode, tidak dipindah** |
| CLI setup | `scripts/cli.mjs` | hanya menulis `opencode.json` |
| Logika inti | `src/coach.ts`, `src/competency.ts`, `src/student-model.ts`, dll. | **tidak ada** |

Handler tool hanya memakai `args` + `projectDir` (closure). Tidak ada pemakaian context sesi OpenCode, jadi ekstraksi relatif aman.

## 3. Arsitektur Target

```
src/
  core/ … (modul yang sudah ada, tidak dipindah fisik di v3.0 agar diff kecil)
  tools/
    registry.ts        ← ToolDef[]: { name, description, schema (zod), handler(args, ctx) }
    index.ts           ← export semua ToolDef
  personas/            ← lihat §1.1
    types.ts           ← Persona { id, writePolicy, handoffTo, default }
    definitions.ts     ← TEACHER, COACH
    prompts.ts         ← isi prompt dengan placeholder {{SWITCH_TO_COACH}} dll. + renderPrompt()
    platform-hints.ts  ← istilah ("agent"/"mode") + cara berpindah per platform
  gate/
    check.ts           ← fungsi murni: decideWrite(projectDir, toolName) → allow|deny + alasan
adapters/
  opencode/index.ts    ← pengganti src/index.ts (map registry → tool())
  mcp/server.ts        ← MCP stdio server (map registry → server.tool())
  pi/extension.ts      ← extension Pi (map registry → registerTool)
plugins/
  claude-code/         ← .claude-plugin/plugin.json, agents/, hooks/hooks.json, .mcp.json
scripts/
  cli.mjs              ← + subcommand: mcp, gate-check, setup --platform <p>
```

`ToolContext` minimal: `{ projectDir: string, platform: "opencode" | "mcp" | "pi" }`.

## 4. Fase

---

### Fase 0 — Spike & Verifikasi Asumsi

**Tujuan:** memastikan API tiap platform sesuai asumsi sebelum menulis kode produksi.

> **Status: SELESAI (2026-11-10)** — 7/7 tugas selesai.

**Tugas:**
- [x] 0.1 Bun 1.4.4 dipasang via Homebrew; `bun install`, baseline test/typecheck/build dicatat di bawah.
- [x] 0.2 Claude Code: struktur plugin, format hook deny, dan `claude --agent` terverifikasi (dokumen + uji langsung).
- [x] 0.3 Nama tool MCP plugin = `mcp__plugin_<plugin>_<server>__<tool>`; wildcard `mcp__plugin_codingschool_cs__*` di `tools:` agent **berfungsi** (diuji).
- [x] 0.4 Pi: API extension terverifikasi dari paket `@earendil-works/pi-coding-agent@1.5.1` (lihat ringkasan). **Asumsi "Pi tanpa MCP" salah** — Pi punya MCP bawaan.
- [x] 0.5 "DeepSeek harness" = **DeepSeek Harness (`dsh`) resmi** dari deepseek-ai, di desktop, TUI, dan CLI (dikonfirmasi pemilik produk).
- [x] 0.6 Library: `@modelcontextprotocol/sdk@1.32.2` (MIT, update terakhir 2026-10-23), peer `zod ^3.25 || ^4.0`. Lihat issue F0-04 soal versi zod.
- [x] 0.7 Prototipe throwaway (MCP server + guard + plugin) dibuat di scratchpad, **tidak di repo**.

**Ringkasan hasil spike**

*Claude Code* (sumber: code.claude.com/docs — `plugins-reference`, `hooks`, `sub-agents`, `mcp`, `tools-reference`, `cli-reference`)
- Plugin: `.claude-plugin/plugin.json` (hanya `name` wajib), `agents/*.md`, `hooks/hooks.json` (dibungkus key `"hooks"`), `.mcp.json` (`"mcpServers"`), semuanya di root plugin. `${CLAUDE_PLUGIN_ROOT}` tersedia di command hook dan konfigurasi MCP.
- Deny di `PreToolUse`: **exit code 2 + pesan di stderr** → pesan sampai ke model (`PreToolUse:Write hook error: …`). Terbukti di uji langsung.
- Tool penulis file: `Write`, `Edit`, `NotebookEdit`. `MultiEdit` sudah *legacy* (boleh tetap dimasukkan ke matcher untuk kompatibilitas).
- Agent utama: `claude --agent teacher` mengganti system prompt default; bisa juga default lewat `"agent"` di `settings.json` plugin. **Tidak ada cara terdokumentasi untuk berganti agent utama di tengah sesi** (lihat F0-02).
- Untuk agent plugin, field `hooks`/`mcpServers`/`permissionMode` di frontmatter **diabaikan** → wajib lewat `hooks/hooks.json` dan `.mcp.json`.
- Instalasi: `claude --plugin-dir <dir>` (dev), atau `.claude-plugin/marketplace.json` + `claude plugin marketplace add <owner>/<repo>` + `claude plugin install codingschool@<marketplace>`.

*Pi* (sumber: `docs/extensions.md`, `docs/mcp.md`, `CHANGELOG.md` di paket 1.5.1; repo github.com/earendil-works/pi)
- Paket pindah: `@mariozechner/pi-coding-agent` deprecated → `@earendil-works/pi-coding-agent`.
- MCP bawaan (sejak 0.87.1): `.pi/mcp.json` / `~/.pi/agent/mcp.json` (`mcpServers`), `pi mcp add`, atau `pi.registerMcpServer()` dari extension.
- Blok tool: `pi.on("tool_call", …)` → `{ block: true, reason }`. Tool bawaan penulis: `write`, `edit`, dan `bash`/`powershell`.
- Persona: `before_agent_start` → `{ systemPrompt }`, `pi.registerCommand("teacher", …)`, `pi.setActiveTools([...])`. Contoh resmi yang paling dekat: `examples/extensions/preset.ts`.
- Schema tool native = TypeBox/JSON Schema (bukan zod) — tidak relevan bila memakai MCP.

*DeepSeek Harness* (sumber: github.com/deepseek-ai/deepseek-harness, `docs/tool-execution-pipeline.md`)
- `npx @deepseek-ai/dsh` (0.2.2-rc.1, **developer preview, akan ada breaking change**). MCP lewat `@deepseek-ai/dsh-mcp-client`; hook `tools/pre-execute` + guard; paket eksperimental `@deepseek-ai/dsh-hooks-claude-code` menjalankan `hooks.json` Claude Code.
- Alternatif komunitas: Codewhale (eks DeepSeek-TUI) — MCP + hook `tool_call_before` (exit 2) + bisa install plugin Claude Code (tapi menolak plugin yang butuh hook).

**Deliverable:** tabel §1 sudah diperbarui; Fase 4–6 disesuaikan (lihat catatan "Diubah oleh Fase 0").

#### Gerbang Fase 0

**Validasi**
- [x] Setiap asumsi di tabel §1 berstatus *Terverifikasi* / *Diubah* dengan sumber — Claude Code & Pi terverifikasi; DSH terverifikasi dari dokumen tapi belum diuji langsung.
- [x] Baseline test tercatat.

**Audit**
- [x] Library MCP: lisensi MIT (cocok dengan `LICENSE.md` MIT), aktif dipelihara. **CVE ditemukan pada dependensi zod** → F0-04.
- [x] Prototipe tidak di-commit; berada di scratchpad sesi. `git status` repo hanya berisi `.gitignore` dan `docs/`.
- [x] `bun install` sempat menulis ulang `bun.lock` → dikembalikan dengan `git checkout bun.lock`, dicatat sebagai F0-01.

**Test**
- [x] `bun test` → baseline: **354 pass / 0 fail** (663 expect, 25 file, 1,78 s)
- [x] `bun run typecheck` → **lulus** (exit 0)
- [x] `bun run build` → **lulus** (`index.js` 233,29 KB, `tui.js` 11,18 KB)
- [x] MCP `tools/list` via stdio mentah → mengembalikan JSON Schema yang benar dari zod v4
- [x] Prototipe MCP terpanggil dari Claude Code (`claude -p`, model haiku): **ya** (`PONG:spike`)
- [x] Hook deny memblokir `Write` tanpa claim: **ya**; dengan claim terbuka: **diizinkan**; JSON rusak: **deny** (fail-closed)
- [x] Plugin spike: `claude plugin validate` → **✔ Validation passed**
- [x] `claude --plugin-dir … --agent teacher`: prompt Teacher aktif, hanya punya `Read/Glob/Grep/mcp__plugin_codingschool_cs__cs_ping`, **tidak punya `Write`**
- [x] Tulis via Bash tanpa claim: tidak diblok oleh gate, tetapi diblok oleh izin bawaan Claude Code (minta persetujuan) → F0-05

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F0-01 | Low | `bun.lock` basi: masih mencantumkan `zod ^3.22.0` yang tidak ada di `package.json`; `bun install` menulis ulang lockfile. | Open → Fase 1 | Fase 1 menambahkan `zod` sebagai dependensi eksplisit dan meng-commit lockfile hasil regenerasi. |
| F0-02 | Medium | Claude Code tidak punya cara terdokumentasi untuk berganti agent utama di tengah sesi. Serah terima Teacher → Coach harus lewat sesi baru (`claude --agent coach`). | Accepted | Fase 1: hint perpindahan per platform. Fase 4: teks hint = "keluar lalu jalankan `claude --agent coach`". State tetap di `.codingschool/`, jadi konteks tidak hilang. |
| F0-03 | Medium | Tool MCP butuh persetujuan izin per tool di Claude Code; `settings.json` plugin hanya mendukung `agent` dan `subagentStatusLine`, jadi plugin tidak bisa memberi izin sendiri. | Open → Fase 6 | `setup --platform claude-code` menawarkan menambah `mcp__plugin_codingschool_cs__*` ke `permissions.allow` (dengan konfirmasi), plus dokumentasi. |
| F0-04 | Medium | `zod@4.1.8` (di-pin oleh `@opencode-ai/plugin@1.19.5`) punya advisory High: "Zod can exhaust memory while validating oversized constrained collections" (perbaikan ≥ 4.6.6). Sudah ada di v2.2.2 lewat dependensi upstream. Dampak nyata rendah (schema kita tidak memakai koleksi berbatas). | Open → Fase 1 | Dependensi langsung `zod@^4.6.7`. Fase 1 wajib menguji apakah schema dari instance zod kita diterima `tool()` OpenCode (zod 4.1.8); bila tidak, adapter OpenCode membangun ulang schema dengan `tool.schema`. |
| F0-05 | Medium | Claim gate tidak mencakup tulis file lewat shell (`Bash` di Claude Code, `bash` di Pi, juga di OpenCode v2.2.2). Di Claude Code, mode izin default tetap meminta persetujuan pengguna, jadi tidak terjadi diam-diam. | Open → Fase 4 | Keputusan di audit Fase 4 (heuristik matcher `Bash` vs batasan terdokumentasi). |
| F0-06 | Low | Asumsi rencana "Pi tidak mendukung MCP" dan nama paket Pi sudah usang. | Closed | Tabel §1 dan Fase 5 diubah: Pi memakai server MCP + extension kecil untuk persona dan gate. |
| F0-07 | Low | "DeepSeek harness" belum dikonfirmasi; kandidat terkuat DSH resmi masih developer preview. | Closed | Dikonfirmasi pemilik produk (2026-11-10): DeepSeek Harness, di desktop, TUI, dan CLI. Karena masih developer preview, dukungan tetap *best-effort*. |
| F0-09 | Medium | Belum diketahui apakah desktop, TUI, dan CLI DeepSeek Harness memakai host plugin yang sama, dan bagaimana persona (agent preset) dipilih di tiap surface. | Open → Fase 6 | Diverifikasi di tugas 6.3. |
| F0-10 | Low | Istilah "agent" vs "mode" berbeda antar produk, berisiko membingungkan desain dan teks untuk siswa. | Closed | Ditambahkan §1.1: istilah netral **Persona** di kode, istilah produk di teks siswa lewat `platform-hints.ts`. |
| F0-08 | Medium | `console.log` di `src/index.ts` (pesan migrasi) akan merusak protokol MCP stdio bila ikut ke bundle MCP. | Open → Fase 3 | Sudah tercakup di audit Fase 3: log dialihkan ke stderr. |

---

### Fase 1 — Ekstraksi Tool Registry & Prompt (refactor tanpa perubahan perilaku)

> **Status: SELESAI (2026-11-10)** — commit `3a200ab` (branch `feat/multi-platform`). Satu validasi (uji manual di OpenCode asli) menunggu pemilik produk, lihat F1-01.

**Tujuan:** memisahkan definisi tool dan prompt dari API OpenCode.

**Tugas:**
- [x] 1.1 `src/tools/types.ts`: `ToolDef`, `ToolContext`, `Platform`, `defineTool`. **Diubah dari rencana:** `args` berupa fungsi `(z) => shape` yang menerima namespace zod milik host (OpenCode: `tool.schema`), bukan zod langsung. Dengan begitu schema tidak pernah tercampur antar instance zod (lihat F0-04).
- [x] 1.2 27 handler dipindah ke `src/tools/registry.ts` (`createToolRegistry({ projectDir, platform })`) secara mekanis dengan script, sehingga isi handler sama persis. **Diubah dari rencana:** masih satu file (932 baris), belum dipecah per kelompok → F1-02.
- [x] 1.3 `src/personas/` dibuat sesuai §1.1: `types.ts`, `definitions.ts` (`TEACHER` = `never`, `COACH` = `claim-gated`), `prompts.ts` (`renderPrompt`). Adapter OpenCode membaca `writePolicy` dari definisi persona.
- [x] 1.4 Teks perpindahan agent di output tool (3 tempat) dan di prompt (2 placeholder) diambil dari `platform-hints.ts`, untuk 5 platform.
- [x] 1.5 `src/gate/check.ts`: `decideWrite(projectDir)` → `{ allow, reason }`.
- [x] 1.6 `src/index.ts` sekarang adapter tipis (1.306 → 90 baris).
- [x] 1.7 Test baru: `src/tools/registry.test.ts`, `src/personas/personas.test.ts`, `src/gate/check.test.ts`, dengan golden fixture `src/__fixtures__/opencode-surface.json` yang direkam dari v2.2.2 sebelum refactor.

**Kriteria selesai:** semua test lama lulus tanpa diubah ✅; `dist/index.js` bisa dimuat dan dijalankan (diuji di Node) ✅.

#### Gerbang Fase 1

**Validasi**
- [x] 27 tool terdaftar dengan nama, deskripsi, schema argumen, dan **urutan** identik dengan v2.2.2 (test fixture + test urutan).
- [x] `renderPrompt("teacher" | "coach", "opencode")` identik byte-per-byte dengan prompt v2.2.2 (test).
- [x] Konfigurasi agent (deskripsi, prompt, mode, izin, urutan key) identik dengan v2.2.2 (test).
- [x] Perilaku identik: alur 7 tool (roadmap → list → prepare phase → prepare capstone → announce complete → engineering status → coach dialog) + `permission.ask` dijalankan di versi lama (dari git) dan baru dengan input yang sama → **output identik** (setelah menormalkan timestamp).
- [x] Alur claim Coach end-to-end lewat adapter OpenCode (otomatis): write ditolak → `cs_claim_open` → write/edit diizinkan → `cs_claim_submit pass` → write ditolak.
- [ ] Uji manual di OpenCode asli → **belum bisa**, OpenCode tidak terpasang di mesin ini (F1-01).

**Audit**
- [x] `grep -rn "@opencode-ai" src/tools src/personas src/gate` (selain file test) → **kosong**.
- [x] Tidak ada logika bisnis di adapter OpenCode: isinya hanya pemetaan tool, persona → izin, dan gate.
- [x] Modul inti tidak berubah sama sekali (`git diff --stat` hanya menyentuh `src/index.ts`, `package.json`, `bun.lock`, `tsconfig.json`, `.gitignore`).
- [x] **Review independen** oleh agent terpisah: diff blok tool lama vs registry baru secara whitespace-strict. Hasil: **tidak ada perbedaan perilaku**, 6 temuan *Low* (F1-03 s.d. F1-08), semuanya sudah diperbaiki.
- [x] Import yang tidak terpakai di registry dibersihkan. Sisa kode mati yang sudah ada sejak v2.2.2 dibiarkan agar diff tetap murni refactor (F1-09).

**Test**
- [x] `bun test` → **370 pass / 0 fail** (baseline 354 + 16 test baru; 744 expect, 28 file)
- [x] `bun run typecheck` → **lulus**
- [x] `bun run build` → **lulus** (`index.js` 234,36 KB, sebelumnya 233,29 KB)
- [x] Smoke test `dist/index.js` di Node: 27 tool, agent `teacher`/`coach`, izin write teacher `deny` / coach `allow`
- [ ] Uji manual OpenCode → menunggu (F1-01)

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F1-01 | Medium | Uji manual di OpenCode asli belum dilakukan karena OpenCode tidak terpasang di mesin dev. | Open | Digantikan sementara oleh uji perilaku lama vs baru + test E2E claim lewat adapter. Pemilik produk perlu menjalankan alur Teacher → Coach sekali di OpenCode sebelum rilis (dicek ulang di Gerbang Fase 7). |
| F1-02 | Low | `src/tools/registry.ts` masih satu file 932 baris, belum dipecah per kelompok seperti rencana 1.2. | Deferred | Sengaja ditunda agar diff Fase 1 murni pemindahan mekanis yang mudah diverifikasi. Bisa dipecah kapan saja tanpa mengubah perilaku (dilindungi test fixture). |
| F1-03 | Low | Tipe `zod` dipakai tapi tidak dideklarasikan di `package.json` (hanya kebetulan ter-hoist dari `@opencode-ai/plugin`). | Closed | `zod@4.1.8` ditambahkan sebagai devDependency, sama dengan versi milik plugin. |
| F1-04 | Low | Cast `def as ToolDef` di adapter menyembunyikan kesalahan tipe. | Closed | Diganti `toOpencodeTool(def: ToolDef<any>)` tanpa cast. |
| F1-05 | Low | Test tidak memeriksa urutan registrasi tool dan urutan key agent/izin. | Closed | Ditambah test urutan terhadap urutan v2.2.2. |
| F1-06 | Low | Output `cs_prepare_capstone` (cabang phase) dan `cs_announce_project_complete` belum dikunci test. | Closed | Ditambah test teks persis untuk OpenCode dan test hint untuk 5 platform. |
| F1-07 | Low | `replaceAll` dengan string pengganti akan menafsirkan `$&`/`$1` bila suatu saat ada di teks hint. | Closed | Diganti fungsi pengganti `() => hint`. |
| F1-08 | Low | Import fixture JSON di test hanya jalan di Bun (`resolveJsonModule` tidak aktif). | Closed | `resolveJsonModule: true` ditambahkan ke `tsconfig.json`. |
| F1-09 | Low | Kode mati yang sudah ada sejak v2.2.2: variabel `lower` di `extractTopic`, fungsi `extractLevelChoice`, variabel `unchecked` di `cs_prepare_capstone`. | Deferred | Bukan regresi. Dibersihkan dalam commit terpisah setelah v3.0.0 agar Fase 1 tetap murni refactor. |
| F0-01 | Low | (dari Fase 0) `bun.lock` basi. | Closed | `bun.lock` diregenerasi (entri `zod ^3.22.0` yang basi hilang) dan diperbarui untuk devDependency `zod`. |
| F0-04 | Medium | (dari Fase 0) advisory zod 4.1.8. | Open → Fase 3 | Di Fase 1 tidak ada zod yang ikut ke bundle (schema dibuat dari `tool.schema` milik OpenCode saat runtime). Server MCP di Fase 3 akan memakai `zod ≥ 4.6.6` miliknya sendiri; pola `args(z)` membuat keduanya tidak bercampur. |

---

### Fase 2 — CLI Platform-Neutral (`gate-check`, `mcp`)

> **Status: SELESAI (2026-11-10)**.

**Tujuan:** menyediakan entrypoint CLI yang bisa dipanggil hook platform mana pun.

**Tugas:**
- [x] 2.1 Logika di `src/cli/gate-check.ts` (fungsi murni `runGateCheck`, mudah dites); entry build `src/gate-check.ts` → `dist/gate-check.js` (41,71 KB). Script `build` di `package.json` diperbarui.
- [x] 2.2 `coding-school gate-check` membaca JSON hook dari stdin (`cwd`, `tool_name`, `agent_type`), lalu memanggil `decideWrite`. Deny = exit 2 + alasan di stderr (format yang terbukti jalan di Claude Code pada Fase 0).
- [x] 2.3 **Diubah dari rencana:** opsi `--format generic` diganti `--format exit-code` (default, untuk Claude Code / Codewhale / jembatan hook DSH) dan `--format json` (selalu exit 0, mencetak `{ allow, reason }`) untuk harness yang membaca keputusan dari stdout.
- [x] 2.4 Resolusi `projectDir`: `--project-dir` > env `CODINGSCHOOL_PROJECT_DIR` > `cwd` dari stdin > `process.cwd()`, dinormalisasi dengan `path.resolve`.
- [x] 2.5 Subcommand `gate-check` didaftarkan di `scripts/cli.mjs` + teks `help`. **Diubah dari rencana:** subcommand `mcp` dipindah ke Fase 3 (bersama server MCP-nya).
- [x] Tambahan (sesuai §1.1): bila payload membawa `agent_type` persona dengan `writePolicy: never` (`teacher` atau `codingschool:teacher`), penulisan **selalu ditolak** meski ada claim terbuka.
- [x] Tambahan: tool yang bukan penulis file (`Read`, tool MCP, dll.) langsung diizinkan, jadi hook aman meski matcher-nya terlalu luas.

#### Gerbang Fase 2

**Validasi**
- [x] Tanpa claim terbuka → exit 2, pesan menyuruh agent memanggil `cs_claim_open` (test + uji langsung).
- [x] Dengan claim terbuka → exit 0 (test + uji langsung).
- [x] Folder `.codingschool/` tidak ada → deny tanpa crash (test).
- [x] **Uji langsung di Claude Code** (`claude -p`, hook `PreToolUse` → `node scripts/cli.mjs gate-check`): tanpa claim, `Write` ditolak dan model menerima pesan `cs_claim_open`; dengan claim terbuka, file berhasil dibuat.

**Audit**
- [x] Stdin divalidasi: JSON rusak, array, `null`, atau angka → deny dengan pesan "invalid hook input" (fail-closed). Stdin kosong diperlakukan sebagai payload kosong (pakai cwd proses), bukan error.
- [x] Path: `projectDir` dinormalisasi; yang dibaca hanya `<projectDir>/.codingschool/claims/*.json` lewat `hasOpenClaim` yang sudah ada. `cwd` berasal dari host (input tepercaya), bukan dari model.
- [x] Waktu eksekusi: 0,09–0,28 s lewat `node dist/gate-check.js`, 0,10–0,14 s lewat `cli.mjs` (5 dan 3 percobaan) → **< 300 ms** ✅. Panggilan pertama (cold start) yang paling lambat.
- [x] Bundle `dist/gate-check.js` tidak berisi `@opencode-ai`/`@opentui` dan tidak memanggil `console.*` (stdout bersih).
- [x] Tidak ada perubahan pada modul inti maupun adapter OpenCode.

**Test**
- [x] Unit test `decideWrite` (open / tidak ada / closed / JSON rusak) → **lulus** (dari Fase 1)
- [x] Unit test `runGateCheck`: 7 nama tool penulis lintas host, tool non-penulis, persona teacher, input rusak, `--format` salah, urutan resolusi `projectDir`, format json → **lulus**
- [x] Integration test: spawn `node dist/gate-check.js` dan `node scripts/cli.mjs gate-check` dengan stdin → **lulus**
- [x] `bun test` total → **384 pass / 0 fail** (+14 test baru)
- [x] `bun run typecheck` → **lulus**; `bun run build` → **lulus**

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F2-01 | Low | Gate hanya memeriksa "ada claim terbuka", bukan apakah file yang ditulis termasuk daftar `files` milik claim. Perilaku ini sama dengan OpenCode v2.2.2 (bukan regresi). | Deferred | Kandidat perbaikan setelah v3.0.0: cocokkan `tool_input.file_path` dengan `files` claim. Perlu keputusan produk karena bisa mengubah alur pair-programming yang sudah ada. |
| F2-02 | Low | Belum diuji langsung apakah Claude Code mengirim `agent_type` di payload hook untuk sesi `claude --agent teacher` (dokumen menyebutnya ada). | Open → Fase 4 | Diuji di Gerbang Fase 4. Tanpa itu pun Teacher tetap aman karena `tools:` Teacher tidak memuat `Write`/`Edit`. |
| F2-03 | Low | Rencana awal menyebut `--format generic` dan subcommand `mcp` di fase ini. | Closed | Diganti `--format exit-code|json`; `mcp` dipindah ke Fase 3. Dicatat di daftar tugas. |

---

### Fase 3 — Adapter MCP Server

> **Status: SELESAI (2026-11-10)**.

**Tujuan:** satu MCP server stdio yang mengekspos 27 tool `cs_*`.

**Tugas:**
- [x] 3.1 `src/mcp/server.ts` (`createMcpServer`): iterasi registry → `registerTool` dengan schema dari `def.args(z)` (zod 4.6.7 milik server). Lokasi `src/mcp/` dipilih alih-alih `adapters/mcp/` agar tetap di bawah `tsconfig` dan build yang sama.
- [x] 3.2 Exception handler → `isError: true` dengan pesan `<tool> failed: <pesan>` tanpa stack trace; stack lengkap dikirim ke stderr. Argumen tidak valid ditolak SDK sebelum handler jalan.
- [x] 3.3 Persona sebagai **MCP prompts** `teacher` dan `coach`, dirender untuk platform host.
- [x] 3.4 Entry `src/mcp.ts` → `dist/mcp.js`; subcommand `coding-school mcp [--project-dir] [--platform claude-code|pi|dsh|mcp]` (juga env `CODINGSCHOOL_PROJECT_DIR` / `CODINGSCHOOL_PLATFORM`).
- [x] 3.5 Bundle MCP **mandiri**: SDK dan zod ikut di-bundle, tanpa `@opencode-ai`/`@opentui`. Artinya plugin Claude Code (Fase 4) cukup menjalankan `node dist/mcp.js` tanpa `node_modules`.
- [x] 3.6 **Diubah dari rencana:** `@opencode-ai/plugin` **tetap di `dependencies`**. Menjadikannya optional peer berisiko membuat OpenCode gagal me-resolve import `tool` saat runtime, dan hal itu tidak bisa diuji tanpa OpenCode (F1-01). Karena bundle MCP mandiri, pengguna host lain tidak bergantung padanya → F3-05.
- [x] Tambahan: `@modelcontextprotocol/sdk@1.32.2` dan `zod@4.6.7` sebagai devDependency, plus `"overrides": { "zod": "4.6.7" }` agar hanya ada satu zod.
- [x] Tambahan: catatan "question tool" per platform di prompt dan di `instructions` server MCP (F3-03).
- [x] Tambahan (keamanan): validasi `repoName` + `execFileSync` di `publishToGitHub`, validasi `folderName` di `initLearningEnv` (F3-01, F3-02).

#### Gerbang Fase 3

**Validasi**
- [x] `tools/list` → tepat 27 tool; deskripsi, `properties`, dan `required` identik dengan fixture v2.2.2 (test).
- [x] Output via MCP **identik** dengan memanggil handler langsung untuk alur 7 tool (roadmap → list → prepare phase → prepare capstone → announce → engineering status → coach dialog) (test).
- [x] `prompts/list` → `teacher`, `coach`; isi = `renderPrompt(id, platform)` (test).
- [x] **Uji langsung di Claude Code** (`claude -p` + `--mcp-config` → `node scripts/cli.mjs mcp --platform claude-code`): `cs_create_roadmap` dan `cs_prepare_capstone` jalan; state tersimpan di `.codingschool/` folder project (Claude Code menjalankan server dengan cwd = folder project); teks untuk siswa memakai "`claude --agent coach`".

**Audit**
- [x] stdout hanya untuk protokol: `console.log`/`console.info` dialihkan ke stderr di entry; log migrasi lewat logger stderr; error `--platform` salah → stdout kosong (test).
- [x] Review tool yang menjalankan perintah eksternal:
  - `publishToGitHub`: **shell injection** lewat `repoName` dari model (`gh repo create ${repoName} …` di `execSync`) → **diperbaiki** (F3-01).
  - `initLearningEnv`: **path traversal** lewat `folderName` (mis. `../luar`) → **diperbaiki** (F3-02).
  - `requirements.ts`: perintah berasal dari daftar statis di kode, bukan dari input model → aman.
  - `getRecentCommits`: `limit` numerik internal → aman.
- [x] Dependensi: hanya `zod@4.6.7` di `node_modules` (sebelumnya SDK membawa salinan `zod@4.1.8` yang punya advisory) → F0-04 ditutup.
- [x] Ukuran bundle `dist/mcp.js`: **1.446 KB** (SDK + zod + ajv, tanpa minify) → F3-04.

**Test**
- [x] Test kontrak MCP in-process (`InMemoryTransport`): daftar tool, kesetaraan output, argumen tidak valid, exception → `isError`, prompts, instructions, resolusi opsi → **lulus**
- [x] Smoke test stdio: `StdioClientTransport` → `node scripts/cli.mjs mcp` (pengganti MCP Inspector; memakai klien SDK resmi yang sama) → 27 tool, `cs_engineering_status` jalan → **lulus**
- [x] Test keamanan: 6 nama repo berbahaya dan 6 nama folder berbahaya ditolak tanpa efek samping → **lulus**
- [x] `bun test` total → **397 pass / 0 fail** (+13 test baru)
- [x] `bun run typecheck` → **lulus**; `bun run build` → **lulus**

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F3-01 | **High** | Shell injection di `publishToGitHub`: `repoName` dari model masuk ke `execSync(\`gh repo create ${repoName} …\`)`. Contoh: `x; rm -rf ~`. Sudah ada sejak v2.2.2, dan makin berisiko karena MCP membuka tool ini ke lebih banyak host. | Closed | Validasi nama repo (`[A-Za-z0-9_.-]`, opsional `owner/`, tanpa `.`/`..`) + `execFileSync("gh", [...])` tanpa shell. Test regresi memastikan perintah berbahaya tidak dijalankan. Catatan: sebelum regex diperketat, satu test sempat memanggil `gh repo create ../x` sungguhan (gagal karena nama tidak valid, tanpa efek). |
| F3-02 | Medium | Path traversal di `initLearningEnv`: `folderName` seperti `../luar` membuat folder + `git init` di luar project. Sudah ada sejak v2.2.2. | Closed | Hanya nama folder tunggal (tanpa `/`, `\\`, `.`, `..`) yang diterima; test regresi. |
| F3-03 | Medium | Sekitar 20 teks di prompt dan output tool (`coach.ts`, `templates.ts`, `diagnosis.ts`, `coach-gate.ts`) menyuruh memakai tool `"question"` milik OpenCode, yang tidak ada di host lain. Ditemukan saat uji langsung di Claude Code. | Closed | Catatan per platform ditambahkan di akhir prompt persona (bagian `HOST ENVIRONMENT`) dan di `instructions` server MCP: Claude Code → `AskUserQuestion`; Pi → teks biasa dengan opsi bernomor; DSH/MCP → tool interaktif bila ada. Prompt OpenCode tetap identik. |
| F3-04 | Low | `dist/mcp.js` 1,45 MB karena SDK, zod, dan ajv ikut di-bundle. | Accepted | Sebanding dengan manfaatnya (tanpa `node_modules`). Opsi `--minify` dievaluasi di Fase 7. |
| F3-05 | Low | Pengguna non-OpenCode yang memasang paket npm tetap ikut mengunduh `@opencode-ai/plugin`. | Deferred | Dievaluasi ulang setelah F1-01 (uji di OpenCode asli) bisa dilakukan. |
| F0-04 | Medium | (dari Fase 0) advisory `zod@4.1.8`. | Closed | Satu versi `zod@4.6.7` lewat `overrides`; bundle MCP tidak lagi berisi 4.1.8. Runtime OpenCode memakai zod milik OpenCode sendiri. |
| F0-08 | Medium | (dari Fase 0) `console.log` merusak protokol stdio. | Closed | Dialihkan ke stderr di entry MCP; migrasi memakai logger stderr. |

---

### Fase 4 — Plugin Claude Code

> **Status: SELESAI (2026-11-10)**.

**Tujuan:** pengalaman Teacher/Coach di Claude Code setara dengan OpenCode.

*Diubah oleh Fase 0: nama tool memakai prefix plugin, deny lewat exit 2, perpindahan agent lewat sesi baru.*

**Tugas:**
- [x] 4.1 **Diubah dari rencana:** manifest ada di **root paket** (`.claude-plugin/plugin.json`), bukan `plugins/claude-code/`. Alasannya, plugin membutuhkan `dist/` (bundle MCP dan gate-check), padahal `dist/` tidak masuk git. Jadi plugin dipasang dari paket npm: `.claude-plugin/marketplace.json` memakai source `npm` (`@codingskuy/coding-school`). `files` di `package.json` ditambah `.claude-plugin/` dan `claude-code/`.
- [x] 4.2 Server MCP `cs` dideklarasikan langsung di manifest: `node ${CLAUDE_PLUGIN_ROOT}/dist/mcp.js --platform claude-code`. Nama tool: `mcp__plugin_codingschool_cs__cs_*`.
- [x] 4.3 `claude-code/agents/teacher.md` & `coach.md` digenerate dari persona (`src/claude-code/plugin.ts`, `bun run gen:claude-code`); test anti-drift memastikan file yang di-commit sama dengan hasil generator.
  - Teacher: `Read, Glob, Grep, AskUserQuestion, WebSearch, WebFetch, TodoWrite, mcp__plugin_codingschool_cs__*` (tanpa `Write`, `Edit`, `NotebookEdit`, `Bash`).
  - Coach: semua di atas + `Write, Edit, NotebookEdit, Bash`.
- [x] 4.4 Hook `PreToolUse` (`Write|Edit|MultiEdit|NotebookEdit`) → `node "${CLAUDE_PLUGIN_ROOT}/dist/gate-check.js" --scope persona`. Opsi baru `--scope persona` di gate-check: hook plugin aktif di **semua** sesi Claude Code, jadi gate hanya bekerja di sesi Teacher/Coach (dideteksi dari `agent_type`) dan tidak pernah memblokir project lain.
- [x] 4.5 Hint perpindahan: "keluar, lalu jalankan `claude --agent codingschool:coach`". **Diubah dari rencana:** default agent lewat `settings.json` plugin **tidak dipakai**, karena akan menjadikan Teacher agent utama di semua sesi Claude Code pengguna.
- [x] 4.6 README: bagian "Claude Code" (instal via marketplace, cara memulai persona, batasan Bash, pengembangan lokal).

#### Gerbang Fase 4

**Validasi** (semua lewat `claude -p --plugin-dir <repo> --agent …`, model haiku/sonnet)
- [x] **Alur lintas platform end-to-end:** roadmap + `cs_prepare_capstone` lewat adapter OpenCode → **Coach di Claude Code**: `cs_timeline_init`/`add` → `cs_claim_open` (konteks "CAPSTONE PROJECT READY from Teacher's roadmap" terbaca) → `Write calc.py` → `cs_claim_submit pass` → `cs_announce_project_complete` → **Teacher di Claude Code**: `cs_resume_session` → `cs_update_progress` → roadmap `- [x] Kalkulator CLI`, `context.json` `currentPhase: done`.
- [x] Teacher tidak bisa menulis file: diminta membuat `notes.txt` → menolak; daftar tool-nya tidak berisi satu pun tool penulis file. Teacher tetap bisa memanggil tool `cs_*`.
- [x] Coach tanpa claim → `Write` ditolak hook ("no open comprehension claim. Call cs_claim_open…"); dengan claim → file dibuat.
- [x] Sesi Claude Code biasa (tanpa persona) di folder yang sama → `Write` **tidak** diblokir.
- [x] State `.codingschool/` dari OpenCode dilanjutkan di Claude Code (alur di atas). Arah sebaliknya memakai file dan modul yang sama (adapter OpenCode dites di Fase 1).
- [ ] Onboarding → diagnosis → quiz tidak diuji langsung di Claude Code; tool-tool itu sama persis lewat MCP (test kesetaraan Fase 3) → F4-04.

**Audit**
- [x] **Celah Bash (F0-05) — diputuskan opsi (b):** Teacher tidak punya `Bash` sama sekali. Coach memiliki `Bash` (dibutuhkan untuk menjalankan test/build proyek); di mode izin default Claude Code, perintah shell yang menulis file tetap meminta persetujuan pengguna (terbukti di Fase 0). Didokumentasikan di README sebagai batasan yang diketahui. Heuristik pada matcher `Bash` ditolak karena mudah diakali dan berisiko memblokir perintah sah.
- [x] Hook memakai `node "${CLAUDE_PLUGIN_ROOT}/dist/gate-check.js"` langsung (tanpa `npx`), < 300 ms (Fase 2).
- [x] Izin agent minimal: Teacher hanya tool baca + `cs_*`; tidak ada `permissionMode`.
- [x] `agent_type` diverifikasi langsung: sesi `--agent teacher` → `"codingschool:teacher"`; sesi biasa → tidak ada → F2-02 ditutup. Agent dari plugin lain yang kebetulan bernama `teacher` (`otherplugin:teacher`) tidak dianggap persona CodingSchool.
- [x] `claude plugin validate .` → **✔ Validation passed** (hanya peringatan: belum ada ikon).

**Test**
- [x] Test generator: file agent + manifest yang di-commit identik dengan hasil generator; versi manifest = `package.json` → **lulus**
- [x] Test wiring manifest: argumen server MCP, matcher hook, perintah hook `--scope persona`, file agent ada, marketplace memakai source npm, `files` npm → **lulus**
- [x] Test akses tool: Teacher tanpa tool penulis (termasuk `Bash`), Coach dengan tool penulis → **lulus**
- [x] Test `gate-check --scope persona` (5 test baru) → **lulus**
- [x] `bun test` total → **410 pass / 0 fail** (+13); `bun run typecheck` → **lulus**
- [x] Uji manual E2E (checklist validasi) → **lulus**

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F4-01 | **High** | Hook plugin Claude Code aktif di **semua** sesi pengguna. Tanpa pembatasan, gate akan memblokir `Write`/`Edit` di setiap project lain yang tidak punya claim CodingSchool. | Closed | `gate-check --scope persona`: gate hanya aktif bila `agent_type` adalah persona CodingSchool. Diuji langsung (sesi biasa tidak diblokir) + test. |
| F4-02 | Medium | Instalasi lewat marketplace (`/plugin install codingschool@codingskuy`) belum bisa diuji: butuh `marketplace.json` di branch utama GitHub dan paket v3.0.0 terbit di npm. | Open → Fase 7 | Sudah diuji lewat `--plugin-dir` dan `claude plugin validate`. Smoke test pasca-publish dijadwalkan di Gerbang Fase 7. |
| F4-03 | Low | Plugin belum punya ikon (peringatan validator `ICON_MISSING`). | Open | Perlu aset PNG persegi 512–2048 px dari pemilik produk. |
| F4-04 | Low | Bagian awal alur belajar (onboarding → diagnosis → quiz) belum dicoba langsung dengan model di Claude Code. | Accepted | Tool yang sama terbukti identik lewat MCP (Fase 3); alur akhir (capstone → Coach → kembali ke Teacher) sudah dicoba langsung. Disarankan dicoba sekali bersama F1-01 sebelum rilis. |
| F4-05 | Low | Teks pindah agent semula `claude --agent coach`, sedangkan README memakai `codingschool:coach`. | Closed | Diseragamkan ke `claude --agent codingschool:<persona>` (nama yang pasti meski ada agent lain bernama sama). |
| F0-05 | Medium | (dari Fase 0) celah tulis lewat shell. | Closed (accepted) | Opsi (b): batasan terdokumentasi; Teacher tanpa Bash. Lihat audit di atas. |
| F2-02 | Low | (dari Fase 2) `agent_type` belum diverifikasi. | Closed | Terverifikasi langsung: `"codingschool:teacher"`. |

---

### Fase 5 — Adapter Pi Agent

> **Status: SELESAI (2026-11-10)**.

**Tujuan:** tool `cs_*` lewat server MCP (Pi punya MCP bawaan), ditambah extension kecil untuk persona dan claim gate.

*Diubah oleh Fase 0: tidak perlu memetakan 27 tool ke `registerTool`; cukup `pi.registerMcpServer()`.*

**Tugas:**
- [x] 5.1 `src/pi/extension.ts` (`createPiExtension`), entry `src/pi.ts` → `dist/pi.js` (69,5 KB). Server MCP didaftarkan lewat `pi.registerMcpServer("codingschool", { command: node, args: [dist/mcp.js, "--platform", "pi"], exposure: "direct" })`. `exposure: "direct"` dipakai karena prompt memanggil tool `cs_*` dengan namanya; default Pi (`codemode`) menyembunyikannya di balik skrip.
- [x] 5.2 Persona = **mode** (§1.1): `/teacher`, `/coach`, `/codingschool off` (dan `/codingschool` untuk status), plus flag `pi --codingschool teacher|coach`. Prompt dimasukkan sebagai section `codingschool` di `systemPromptOptions.sections` (cara yang dianjurkan dokumen Pi, bukan mengganti seluruh `systemPrompt`). Mode disimpan lewat `pi.appendEntry` dan dipulihkan di `session_start`.
- [x] 5.3 `tool_call`: mode Teacher memblok `write`, `edit`, `bash`, `powershell` (juga dicabut dari tool aktif lewat `setActiveTools`); mode Coach memblok `write`/`edit` bila `decideWrite` menolak.
- [x] 5.4 `package.json` → `"pi": { "extensions": ["./dist/pi.js"] }`; README bagian "Pi" (`pi install npm:@codingskuy/coding-school`).
- [x] Tambahan: **tidak aktif sebelum mode dipilih.** Server MCP baru didaftarkan saat `/teacher`/`/coach` dan dilepas saat `off`, sehingga paket yang dipasang global tidak mengubah sesi Pi lain dan tidak menambah 27 tool ke setiap sesi.
- [x] Tambahan: `@earendil-works/pi-coding-agent@1.5.1` sebagai devDependency **hanya untuk tipe** (import `type`), sehingga extension di-typecheck terhadap API Pi asli; build memakai `--external '@earendil-works/*'`.

#### Gerbang Fase 5

**Validasi** (Pi 1.5.1 asli, mode RPC, tanpa model — perintah extension tidak butuh LLM)
- [x] Extension termuat lewat `-e dist/pi.js` **dan** lewat `packages` di `settings.json` (manifest `"pi"` di `package.json`).
- [x] Probe tool aktif per mode: Teacher → bawaan hanya `read` + 27 `mcp__codingschool__cs_*`; Coach → `read, bash, edit, write` + 27 tool; kembali ke Teacher → `read` + 27; `off` → `read, bash, edit, write`, 0 tool cs, 0 server.
- [x] Mode tersimpan sebagai entry `codingschool-mode` di sesi (terlihat lewat RPC `get_entries`).
- [x] State lintas platform: server MCP dan `decideWrite` sama dengan Claude Code, membaca `.codingschool/` di cwd.
- [ ] Alur Teacher → Coach dengan model sungguhan di Pi **belum** diuji: tidak ada API key model di mesin ini → F5-02.

**Audit**
- [x] Extension hanya meng-import modul inti (`gate`, `personas`) dan tipe Pi; tidak meng-import adapter lain. Bundle `dist/pi.js` tidak berisi `@earendil-works` (test).
- [x] Tool penulis bawaan Pi menurut `docs/cli.md`: `write`, `edit`, `bash`, `powershell` — semuanya tercakup untuk Teacher. Panggilan bersarang dari `codemode` tetap memicu `tool_call` dengan nama tool aslinya, jadi tetap terblok.
- [x] **Bug ditemukan saat probe di Pi asli dan diperbaiki** (F5-01).
- [x] Pi tidak punya tool pertanyaan interaktif → catatan "question tool" untuk platform `pi` (Fase 3) meminta opsi bernomor dalam teks.

**Test**
- [x] Unit test dengan `ExtensionAPI` tiruan (13 test): tidak aktif secara default, prompt + server + pencabutan tool di Teacher, blok Teacher meski ada claim, gate Coach, pemulihan tool Teacher → Coach, `off`, pemulihan mode dari sesi, flag `--codingschool` (valid & tidak valid), manifest paket, bundle tanpa paket Pi → **lulus**
- [x] Uji di Pi asli (RPC + extension probe) → **lulus**
- [x] `bun test` total → **422 pass / 0 fail** (+12); `bun run typecheck` (terhadap tipe Pi asli) → **lulus**; `bun run build` → **lulus**

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F5-01 | **High** | Versi pertama memulihkan *snapshot* tool aktif saat keluar dari Teacher. Snapshot diambil sebelum server MCP terdaftar, sehingga setelah `/teacher` → `/coach` tool MCP (via `codemode`) hilang dan Coach tidak bisa memanggil `cs_*`. Ditemukan lewat probe di Pi asli. | Closed | Hanya tool yang dicabut Teacher yang dikembalikan; server MCP didaftarkan sebelum penyaringan; `exposure: "direct"`. Diverifikasi ulang di Pi asli + test regresi. |
| F5-02 | Medium | Alur percakapan Teacher → Coach dengan model sungguhan belum diuji di Pi karena tidak ada API key di mesin dev. | Open → Fase 7 | Mekanisme (perintah, tool aktif, server MCP, blok) sudah diuji di Pi asli tanpa model; isi tool sama dengan Claude Code yang sudah diuji dengan model. Perlu dicoba sekali oleh pemilik produk sebelum rilis. |
| F5-03 | Medium | `bash` di mode Coach tidak di-gate, dan Pi tidak meminta persetujuan sebelum menjalankan perintah shell. Celah tulis lewat shell (F0-05) lebih terbuka di Pi daripada di Claude Code. | Accepted | Didokumentasikan di README. Coach butuh `bash` untuk test/build. Opsi lanjutan setelah v3.0.0: konfirmasi `ctx.ui.confirm` untuk `bash` saat tidak ada claim terbuka. |

---

### Fase 6 — Setup Multi-Platform & Harness MCP Generik

> **Status: SELESAI (2026-11-10)**.

**Tujuan:** instalasi satu perintah untuk setiap platform.

**Tugas:**
- [x] 6.1 `coding-school setup --platform opencode|claude-code|pi|dsh|mcp` + `--yes` untuk mode non-interaktif. **Diubah dari rencana:** tanpa flag tetap OpenCode (bukan deteksi otomatis), demi kompatibilitas v2.2.2. Baris "PI Agent (coming soon)" di alur OpenCode dihapus.
  - `claude-code`: mencetak perintah `/plugin marketplace add` / `/plugin install` / `claude --agent …`.
  - `pi`: menjalankan `pi install npm:@codingskuy/coding-school` (dengan konfirmasi) bila `pi` ada di PATH; bila tidak, mencetak perintahnya.
  - `dsh`: menulis patch preset + hooks Coach ke folder **baru** `$DSH_HOME/codingschool/` (dengan konfirmasi), lalu mencetak langkah instal hook bridge dan `dsh web --patch …`.
- [x] 6.2 `--platform mcp` mencetak snippet `mcpServers` (`npx -y @codingskuy/coding-school mcp --platform mcp`), perintah `gate-check` untuk host yang punya hook, dan penjelasan bahwa tanpa hook gate hanya berbasis prompt.
- [x] 6.3 DeepSeek Harness — hasil riset (dsh 0.2.2-rc.1, repo `fcc0ad4`) dan implementasi:
  - **Surface (F0-09):** DSH punya **Web**, **Desktop** (Electron di atas Web), dan mode CLI `headless`/SDK/ACP. **Tidak ada TUI resmi.** Konfigurasi berbasis profil Cordis (`$DSH_HOME/profiles/<nama>/`); Desktop punya profil dan `node_modules` sendiri. Preset hanya dipasang oleh bundle Web (dipakai Web & Desktop); headless/SDK/ACP tidak punya preset.
  - **Persona:** MCP prompts **tidak didukung** DSH → Teacher/Coach dijadikan dua `@deepseek-ai/dsh-agent-preset` dengan `@deepseek-ai/dsh-persona` (`prefix` = `renderPrompt(…, "dsh")`). Preset hanya bisa dipilih di sesi baru (tidak bisa pindah di tengah sesi).
  - **Tool:** baris `@deepseek-ai/dsh-mcp-client` (`serverName: cs`, stdio `node dist/mcp.js --platform dsh`) di dalam tiap preset.
  - **writePolicy:** Teacher = `dsh-tool-fs` dengan `write/edit/applyPatch: false`, tanpa `dsh-tool-bash` → tidak punya tool penulis sama sekali. Coach = `@deepseek-ai/dsh-hooks-claude-code` dipasang **di dalam preset Coach** dengan `coach-hooks.json` → `gate-check --persona coach`. Hook bridge DSH tidak mengirim `agent_type`, maka ditambahkan flag `--persona` di gate-check, plus nama tool penulis DSH (`apply_patch`, `str_replace_editor`).
  - Implementasi: `src/dsh/patch.ts` (generator), entry `src/dsh-setup.ts` → `dist/dsh-setup.js` (30 KB).
  - Codewhale **tidak diuji** → F6-05.
- [x] 6.3b `setup --platform claude-code` menawarkan izin `mcp__plugin_codingschool_cs__*` di `~/.claude/settings.json` (atau `$CLAUDE_CONFIG_DIR`), dengan backup `.bak`; file JSON rusak tidak disentuh → F0-03 ditutup.
- [x] 6.4 `postinstall.mjs`: banner tanpa nomor versi (sebelumnya basi "v2.1") dan menyebut semua platform; tetap hanya mencetak teks.
- [x] 6.5 README: bagian "🧩 Supported Platforms" (matriks setup, istilah persona, cara berpindah, penegakan gate, sidebar TUI hanya OpenCode) + bagian "Pi".
- [x] Tambahan: perbaikan bug lama `mkdirSync` tidak di-import di `scripts/cli.mjs` (F6-01).

#### Gerbang Fase 6

**Validasi**
- [x] `setup --project` tanpa `--platform` membuat `opencode.json` berisi `plugin: ["@codingskuy/coding-school"]` seperti v2.2.2 (test).
- [x] `--platform claude-code`: izin ditambahkan sekali, setting lain dan `deny` tetap utuh, backup dibuat, idempoten (test di `HOME` sementara).
- [x] `--platform pi`: tanpa `pi` di PATH → mencetak perintah instal (test). Instal sebagai paket Pi sudah terbukti di Fase 5 (`packages` di `settings.json`).
- [x] `--platform dsh`: patch dan hooks ditulis ke `$DSH_HOME/codingschool/` (test); patch hasil generator **dikomposisi oleh DSH 0.2.2-rc.1 asli** tanpa error (`dsh web --dump-config --patch …`, exit 0, kedua preset + baris MCP + baris gate terbaca).
- [x] Hook Coach DSH dijalankan dengan payload persis milik hook bridge DSH (tanpa `agent_type`): `write`/`edit`/`apply_patch`/`str_replace_editor` ditolak tanpa claim, diizinkan dengan claim; `read` diizinkan (test).
- [x] `--platform mcp`: snippet JSON valid (test). Server MCP generik sudah diuji dengan klien SDK resmi di Fase 3.
- [ ] Sesi DSH Web dengan model sungguhan (memilih preset, memanggil `cs_*`, gate Coach) belum diuji: butuh API key DeepSeek → F6-03.

**Audit**
- [x] Tidak ada konfigurasi pengguna yang ditimpa tanpa konfirmasi: semua penulisan butuh TTY + konfirmasi atau `--yes`; tanpa itu → "Skipped" (test). Claude Code: backup `.bak` + JSON rusak tidak disentuh. DSH: hanya menulis ke folder baru `codingschool/`, tidak mengubah `cordis.patch.yml` milik pengguna.
- [x] `postinstall` hanya `console.log`, tidak membaca stdin dan tidak menulis file → aman di CI/non-TTY.
- [x] Teks persona DSH tidak mengandung `{{` (yang akan diekspansi template `dsh-persona`) (test).
- [x] Perintah eksternal di setup memakai `spawnSync` dengan array argumen (tanpa shell).

**Test**
- [x] `src/cli/setup.test.ts` (12 test): platform tidak dikenal, default OpenCode, Claude Code (cetak, non-TTY, `--yes` + backup + idempoten, file baru, JSON rusak), Pi, DSH (tulis / tidak tulis), MCP → **lulus**
- [x] `src/dsh/patch.test.ts` (6 test): preset + prompt, MCP, Teacher tanpa penulis, gate Coach, tanpa `{{`, hook Coach dengan payload DSH → **lulus**
- [x] `gate-check`: nama tool DSH + `--persona` → **lulus**
- [x] Uji komposisi di DSH asli (`--dump-config`) → **lulus**
- [x] `bun test` total → **440 pass / 0 fail** (+18); `bun run typecheck` → **lulus**; `bun run build` → **lulus**

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F6-01 | Low | Bug lama: `ensureDir` di `scripts/cli.mjs` memanggil `mkdirSync` yang tidak di-import (ReferenceError bila folder belum ada). | Closed | Import ditambahkan; dipakai juga oleh penulisan `~/.claude/settings.json`. |
| F6-02 | Medium | DSH: preset hanya ada di **Web**. Desktop memakai profil terpisah dan tidak bisa diberi `--patch`; headless/SDK/ACP tidak punya preset. Tidak ada TUI resmi, jadi target "desktop, TUI, CLI" dari pemilik produk belum bisa dipenuhi penuh. | Open | Didokumentasikan di README. Langkah lanjutan: kemas sebagai bundle plugin DSH (`"dsh": { "bundle": … }` di `package.json`) agar bisa dipasang di profil Desktop lewat `dsh plugin --profile desktop add`. Ditunda karena DSH mewajibkan pin versi persis (`engines.dsh`) dan peer dependency DSH yang akan membebani pengguna OpenCode. |
| F6-03 | Medium | Sesi DSH dengan model sungguhan belum diuji (tidak ada API key DeepSeek di mesin dev). Belum terverifikasi saat runtime: hook bridge yang dipasang di dalam preset hanya menerima tool call preset itu. | Open → Fase 7 | Komposisi patch sudah diverifikasi di DSH asli; hook diuji dengan payload persis. Perlu dicoba sekali oleh pemilik produk. |
| F6-04 | Medium | DSH masih developer preview: paket plugin mem-pin versi DSH persis, tag `latest` beberapa paket basi, dan `dsh-hooks-claude-code` masih eksperimental. Perubahan versi DSH bisa merusak integrasi. | Accepted | Setup mencetak `@<your dsh version>` untuk paket hook. Integrasi berstatus *best-effort* di README. |
| F6-05 | Low | Codewhale (eks DeepSeek-TUI) belum diuji. | Deferred | Server MCP + `gate-check` (exit 2) sesuai mekanisme hook Codewhale (`tool_call_before`); diuji setelah v3.0.0 bila ada permintaan. |
| F0-03 | Medium | (dari Fase 0) izin tool MCP Claude Code. | Closed | `setup --platform claude-code` menawarkan izin dengan backup. |
| F0-09 | Medium | (dari Fase 0) surface DSH. | Closed (lihat F6-02) | Diteliti: Web/Desktop/headless; tanpa TUI; preset hanya Web/Desktop. |

---

### Fase 7 — Rilis v3.0.0

**Tugas:**
- [ ] 7.1 CI: matriks job `test`, `typecheck`, `build`, test kontrak MCP, validasi plugin Claude Code.
- [ ] 7.2 `package.json`: `exports` baru (`./mcp`, `./pi`), `bin` tetap `coding-school`, `files` mencakup `plugins/`.
- [ ] 7.3 `CHANGELOG.md` + panduan migrasi (pengguna OpenCode: tidak ada aksi yang diperlukan).
- [ ] 7.4 Bump `2.2.2 → 3.0.0`, `npm publish --dry-run`, cek isi tarball.

#### Gerbang Fase 7

**Validasi**
- [ ] Install bersih dari tarball di tiga platform berhasil.
- [ ] Pengguna OpenCode v2.2.2 bisa upgrade tanpa mengubah konfigurasi.

**Audit**
- [ ] `npm pack --dry-run`: tidak ada file sensitif (`.env`, `PRD*.md`, `.codingschool/`, `graphify-out/`).
- [ ] `npm audit` tanpa temuan High/Critical.
- [ ] Semua issue *High* di Fase 0–6 berstatus *Closed*; issue *Medium/Low* yang ditunda tercatat di CHANGELOG sebagai known issue.

**Test**
- [ ] CI hijau di semua job → `___`
- [ ] Smoke test pasca-publish (`npx @codingskuy/coding-school@3.0.0 mcp`) → `___`

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F7-01 | | | | |

---

## 5. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| API plugin/extension Claude Code atau Pi berbeda dari asumsi | Fase 4/5 molor | Fase 0 spike; adapter dibuat tipis agar mudah diubah |
| Prompt drift antar platform | Perilaku Teacher/Coach berbeda | Satu sumber `renderPrompt` + snapshot test |
| Claim gate tidak bisa ditegakkan di harness tanpa hook | Siswa bisa minta agent menulis kode langsung | Dokumentasikan; tandai platform "prompt-only" di matriks fitur |
| Celah tulis file via Bash | Claim gate bisa dilewati | Keputusan eksplisit di audit Fase 4 |
| `console.log` di modul inti merusak protokol MCP stdio | Server MCP crash/korup | Audit Fase 3, alihkan log ke stderr |
| Perubahan dependency (`@opencode-ai/plugin` → peer) | Instalasi OpenCode rusak | Uji upgrade di Gerbang Fase 7 |

## 6. Definisi Severity Issue

| Severity | Arti |
|---|---|
| **High** | Merusak alur belajar, membocorkan data, atau claim gate bisa dilewati tanpa sengaja. Memblokir fase berikutnya. |
| **Medium** | Fitur tidak bekerja di satu platform tapi ada workaround. Boleh ditunda dengan catatan. |
| **Low** | Kosmetik, teks, dokumentasi. |
