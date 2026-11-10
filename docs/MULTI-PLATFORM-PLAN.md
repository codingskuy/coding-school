# Rencana Implementasi: CodingSchool Multi-Platform

> Status: **Fase 0–2 selesai , Fase 3 sedang berjalan** · Dibuat: 2026-11-10 · Basis kode: v2.2.2 (`a24fd8d`)
> Target rilis: **v3.0.0**

## 1. Tujuan

Membuat CodingSchool (Teacher + Coach) bisa berjalan di beberapa agent harness selain OpenCode:

*(Diperbarui setelah Fase 0 — lihat Gerbang Fase 0 untuk bukti.)*

| Platform | Mekanisme tool | Mekanisme agent | Penegakan claim gate |
|---|---|---|---|
| OpenCode (sudah ada) | `tool()` plugin | hook `config` | hook `permission.ask` |
| Claude Code | MCP server (stdio) di `.mcp.json` plugin | `agents/*.md` + `claude --agent teacher\|coach` | hook `PreToolUse` (exit 2) → `gate-check` |
| Pi agent (`@earendil-works/pi-coding-agent` ≥ 1.0) | MCP server (Pi punya MCP bawaan sejak 0.87.1) | extension kecil: `/teacher` `/coach` via `before_agent_start` + `setActiveTools` | extension: event `tool_call` → `{ block: true }` |
| DeepSeek Harness (`@deepseek-ai/dsh`, developer preview) — desktop, TUI, dan CLI | MCP server (`dsh-mcp-client`) | agent preset YAML (belum diverifikasi) | `dsh-hooks-claude-code` menjalankan `hooks.json` Claude Code (eksperimental) |
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
| DeepSeek Harness (desktop, TUI, CLI) | *agent preset* | preset YAML (`agent-preset-registry`) + plugin Cordis | pilih preset / command (diverifikasi di Fase 6) | hook `tools/pre-execute` / `dsh-hooks-claude-code` |
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

**Tujuan:** satu MCP server stdio yang mengekspos 27 tool `cs_*`.

**Tugas:**
- [ ] 3.1 `adapters/mcp/server.ts`: buat server, iterasi registry → daftarkan tool (nama, deskripsi, schema zod → JSON Schema).
- [ ] 3.2 Handler membungkus error menjadi `isError: true` dengan pesan yang bisa dibaca agent (bukan stack trace).
- [ ] 3.3 Ekspos prompt Teacher/Coach juga sebagai **MCP prompts** (`teacher`, `coach`) untuk harness yang tidak punya konsep subagent.
- [ ] 3.4 Build target `dist/mcp.js`; jalankan dengan `npx @codingskuy/coding-school mcp`.
- [ ] 3.5 Pastikan bundle MCP **tidak** meng-import `@opencode-ai/plugin` atau `@opentui/*`.
- [ ] 3.6 Pindahkan `@opencode-ai/plugin` ke `peerDependencies` (optional) agar pengguna non-OpenCode tidak wajib menginstallnya; verifikasi OpenCode tetap jalan.

#### Gerbang Fase 3

**Validasi**
- [ ] `tools/list` mengembalikan tepat 27 tool dengan schema yang cocok dengan snapshot Fase 1.
- [ ] Setiap tool bisa dipanggil via MCP Inspector dengan argumen contoh dan menghasilkan output yang sama dengan adapter OpenCode.
- [ ] `prompts/list` mengembalikan `teacher` dan `coach`.

**Audit**
- [ ] Server tidak menulis apa pun ke stdout selain protokol MCP (log → stderr). `console.log` di modul inti (mis. migrasi di `src/index.ts:76`) dialihkan.
- [ ] Tool yang menjalankan perintah eksternal (`cs_publish_handbook`, `cs_init_learning_env`) di-review untuk injeksi argumen.
- [ ] Ukuran bundle `dist/mcp.js` dicatat: `___ KB`.

**Test**
- [ ] Test kontrak: untuk setiap tool, panggil via MCP client in-process dan bandingkan dengan pemanggilan handler langsung → `___`
- [ ] Smoke test: `npx @modelcontextprotocol/inspector node dist/mcp.js` → `___`
- [ ] `bun test` total → `___ pass / ___ fail`

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F3-01 | | | | |

---

### Fase 4 — Plugin Claude Code

**Tujuan:** pengalaman Teacher/Coach di Claude Code setara dengan OpenCode.

**Tugas:**
- [ ] 4.1 `plugins/claude-code/.claude-plugin/plugin.json` (nama, versi tersinkron dengan `package.json`).
*Diubah oleh Fase 0: nama tool memakai prefix plugin, deny lewat exit 2, perpindahan agent lewat sesi baru.*

- [ ] 4.2 `.mcp.json` → server `cs` menjalankan `node ${CLAUDE_PLUGIN_ROOT}/dist/mcp.js` (bukan `npx`, agar cepat dan versinya sama dengan plugin). Nama tool akhir: `mcp__plugin_codingschool_cs__cs_*`.
- [ ] 4.3 `agents/teacher.md` & `agents/coach.md` digenerate dari `renderPrompt(…, "claude-code")` oleh script build (bukan ditulis tangan, agar tidak drift).
  - Teacher: `tools: Read, Glob, Grep, mcp__plugin_codingschool_cs__*` (**tanpa** `Write`, `Edit`, `NotebookEdit`).
  - Coach: tool di atas + `Write`, `Edit`, `NotebookEdit`, `Bash`.
- [ ] 4.4 `hooks/hooks.json`: `PreToolUse` matcher `Write|Edit|MultiEdit|NotebookEdit` → `node "${CLAUDE_PLUGIN_ROOT}/dist/gate-check.js"` (deny = exit 2 + stderr).
- [ ] 4.5 Hint perpindahan agent: "keluar, lalu jalankan `claude --agent coach`" (F0-02). Default agent plugin lewat `settings.json` → `{"agent": "teacher"}`.
- [ ] 4.6 Dokumentasi instalasi di README (marketplace/`/plugin install` atau path lokal).

#### Gerbang Fase 4

**Validasi**
- [ ] Alur lengkap end-to-end di Claude Code: onboarding → diagnosis → roadmap → quiz → capstone → Coach → claim → tulis kode → submit → kembali ke Teacher.
- [ ] Teacher tidak bisa menulis file (dicoba langsung meminta "buatkan file x").
- [ ] Coach tanpa claim terbuka → `Write` ditolak oleh hook; dengan claim → diizinkan.
- [ ] State `.codingschool/` yang dibuat di OpenCode bisa dilanjutkan di Claude Code (dan sebaliknya).

**Audit**
- [ ] **Celah Bash:** Coach/Teacher masih bisa menulis file lewat `Bash` (`echo > file`). Putuskan: (a) tambah matcher `Bash` dengan heuristik redirect/`tee`/`sed -i`, atau (b) terima sebagai batasan yang terdokumentasi. Celah yang sama juga ada di OpenCode v2.2.2 → catat di log issue.
- [ ] Hook tidak bergantung pada `npx` yang lambat untuk setiap write (pertimbangkan path absolut ke `dist/gate-check.js` via `${CLAUDE_PLUGIN_ROOT}`).
- [ ] Tidak ada izin berlebihan di frontmatter agent.

**Test**
- [ ] Test generator: `agents/*.md` hasil build cocok dengan `renderPrompt` → `___`
- [ ] Test `hooks.json` valid JSON & matcher benar → `___`
- [ ] Uji manual E2E (checklist validasi) → `___`

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F4-01 | | | | |

---

### Fase 5 — Adapter Pi Agent

**Tujuan:** tool `cs_*` lewat server MCP (Pi punya MCP bawaan), ditambah extension kecil untuk persona dan claim gate.

*Diubah oleh Fase 0: tidak perlu memetakan 27 tool ke `registerTool`; cukup `pi.registerMcpServer()`.*

**Tugas:**
- [ ] 5.1 `adapters/pi/extension.ts` (target `@earendil-works/pi-coding-agent` ≥ 1.0): daftarkan server MCP lewat `pi.registerMcpServer()` yang menunjuk ke `dist/mcp.js`.
- [ ] 5.2 Persona: `pi.registerCommand("teacher")` / `("coach")` + `before_agent_start` → `{ systemPrompt }` dari `renderPrompt(…, "pi")`; mode Teacher memakai `pi.setActiveTools` tanpa `write`/`edit`. Mode disimpan dengan `pi.appendEntry()`.
- [ ] 5.3 `pi.on("tool_call")`: blok `write`/`edit` bila `decideWrite` → deny (mode Teacher selalu deny).
- [ ] 5.4 Paket: `package.json` → `"pi": { "extensions": ["./dist/pi.js"] }` agar bisa dipasang via `packages` (`npm:@codingskuy/coding-school`) + dokumentasi.

#### Gerbang Fase 5

**Validasi**
- [ ] Semua 27 tool terpanggil di Pi.
- [ ] Mode Teacher tidak bisa menulis file; mode Coach hanya saat claim terbuka.
- [ ] State lintas platform tetap kompatibel.

**Audit**
- [ ] Extension tidak meng-import adapter lain.
- [ ] Nama tool penulis file di Pi sudah lengkap tercakup oleh blok.

**Test**
- [ ] Unit test pemetaan registry → format tool Pi → `___`
- [ ] Uji manual alur Teacher → Coach di Pi → `___`
- [ ] `bun test` total → `___ pass / ___ fail`

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F5-01 | | | | |

---

### Fase 6 — Setup Multi-Platform & Harness MCP Generik

**Tujuan:** instalasi satu perintah untuk setiap platform.

**Tugas:**
- [ ] 6.1 `coding-school setup --platform opencode|claude-code|pi|mcp` (default: deteksi otomatis; perilaku lama tetap untuk `setup` tanpa flag).
- [ ] 6.2 `--platform mcp` mencetak snippet konfigurasi MCP generik + peringatan bahwa claim gate hanya berbasis prompt.
- [ ] 6.3 DeepSeek Harness (*best-effort*, developer preview), di **ketiga surface: desktop, TUI, CLI**:
  - Verifikasi apakah ketiga surface memakai host plugin Cordis yang sama (satu paket plugin untuk semua) atau perlu konfigurasi terpisah (F0-09).
  - Persona: daftarkan Teacher/Coach sebagai *agent preset* (YAML) dan cek cara berpindah preset di tiap surface.
  - Tool: server MCP lewat `dsh-mcp-client`.
  - `writePolicy`: hook `tools/pre-execute` / guard, atau `dsh-hooks-claude-code` dengan `hooks.json` dari Fase 4.
  - Uji juga Codewhale (MCP + hook `tool_call_before`).
- [ ] 6.3b `setup --platform claude-code` menawarkan izin `mcp__plugin_codingschool_cs__*` (F0-03).
- [ ] 6.4 Perbarui `postinstall.mjs` agar tidak menganggap OpenCode satu-satunya target.
- [ ] 6.5 README: matriks fitur per platform (termasuk sidebar TUI = OpenCode saja).

#### Gerbang Fase 6

**Validasi**
- [ ] `setup` tanpa flag berperilaku identik dengan v2.2.2.
- [ ] Setiap `--platform` menghasilkan konfigurasi yang terbukti jalan (diuji di mesin bersih / direktori sementara).

**Audit**
- [ ] `setup` tidak menimpa konfigurasi pengguna tanpa backup/konfirmasi.
- [ ] `postinstall` tidak menulis ke luar direktori yang diharapkan dan tidak gagal di CI (non-TTY).

**Test**
- [ ] Test `setup` per platform di temp dir (cek file yang dihasilkan) → `___`
- [ ] Uji harness MCP generik → `___`

**Log Issue**

| ID | Severity | Deskripsi | Status | Resolusi |
|---|---|---|---|---|
| F6-01 | | | | |

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
