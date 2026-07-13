# Product Requirements Document (PRD)
## CodingSchool Plugin untuk OpenCode

---

### 1. Ringkasan Produk

**CodingSchool** adalah plugin OpenCode yang berfungsi sebagai mentor pembelajaran software engineering dengan pendekatan AI-powered, bukan AI-dependent. Plugin ini menempatkan fokus pada pengembangan pemahaman konsep, bukan sekadar generasi kode otomatis.

---

### 2. Visi & Tujuan

#### 2.1 Visi Utama
> **Learn Software Engineering with AI, not From AI.**

#### 2.2 Tujuan
- Membangun pemahaman konsep software engineering melalui AI mentor
- Mencegah ketergantungan berlebihan pada AI untuk penyelesaian masalah
- Membuat pengguna sadar akan "why" di balik "how"
- Menyediakan sistem pembelajaran terstruktur dengan siklus Bloom Taxonomy

---

### 3. Arsitektur Plugin

#### 3.1 Diagram Posisi
```
OpenCode
    │
    ├── Plan
    ├── Build
    └── Coach ⭐  ← Mode baru yang ditambahkan
        │
        └── CodingSchool Core
            ├── Learning Engine
            ├── Roadmap Generator
            ├── Assessment Engine
            ├── Knowledge Tracker
            ├── Progress Manager
            └── Reflection Engine
                │
                └── .codingschool/
```

#### 3.2 Teknologi yang Digunakan
- **Runtime**: Bun.js (Node.js runtime)
- **Framework**: OpenCode Plugin V2 Effect
- **Bahasa**: TypeScript
- **Dependencies**: Zod (validasi), fs-extra (file operations)

---

### 4. Spesifikasi Fitur (v1.0)

#### 4.1 Coach Agent (Mode Baru)

**Deskripsi**: Agent mentor yang menunjukkan pilihan antara "menyelesaikan pekerjaan" atau "belajar membangun kemampuan".

**Implementasi**:
```typescript
// opencode.jsonc
"agent": {
  "coding-school": {
    "description": "Mentor pembelajaran software engineering",
    "mode": "subagent",
    "tools": { "write": false, "edit": false }
  }
}
```

**Behavior**:
- Jika user memilih A: Lanjut ke selesai pekerjaan
- Jika user memilih B: Aktifkan Learning Engine

**Onboarding Session Baru**:
Saat user pertama kali berinteraksi dengan Coach (tidak ada `.codingschool/profile.md`):
```
Tool call: cs_resume_session() → file not found
→ Coach: "Halo! Saya mentor kamu.
   Ceritakan goal belajar atau topik yang ingin kamu pelajari.
   Saya akan buat learning plan yang sesuai."
```

**Estimasi Konteks saat Onboarding**:
Coach menampilkan estimasi kebutuhan konteks agar user sadar sejak awal:
```
Topik: Dart Data Structure

Estimasi kebutuhan konteks:
  Beginner  ≈ 25k context
  Intermediate ≈ 80k context
  Expert   ≈ 250k context

Pilih level untuk memulai.
```

**Prerequisite Checking**:
Sebelum menjawab pertanyaan teknis user, Coach WAJIB membaca `.codingschool/roadmap/<topic>/<level>.md` untuk:
1. Mengecek apakah topik yang ditanyakan ada di roadmap
2. Memeriksa prerequisites yang belum diselesaikan
3. Jika ada prerequisite yang belum: tolak explain dan arahkan ke prerequisite dulu

Contoh:
```
User: "Bagaimana membuat Binary Search?"
Coach (tool call: read .codingschool/roadmap/algoritma/beginner.md):
→ "Binary Search ada di roadmap-mu. Tapi kamu belum selesaikan Sorting.
   Selesaikan Sorting dulu — Binary Search akan lebih mudah dipahami setelahnya."
```

---

#### 4.2 Learning Plan Generator

**Deskripsi**: Membuat roadmap pembelajaran dalam format Markdown di `.codingschool/roadmap/`.

**Struktur Direktori**:
```
.codingschool/
├── profile.md
├── progress.json
├── roadmap/
│   ├── dart/
│   │   ├── beginner.md
│   │   ├── intermediate.md
│   │   └── expert.md
│   ├── flutter/
│   ├── git/
│   ├── architecture/
│   └── testing/
├── sessions/
├── quizzes/
├── reports/
└── certificates/
```

**Format Learning Contract** (contoh):
```markdown
# Dart Data Structure

Status: 🟨 In Progress

---

## Target
Mampu menggunakan seluruh collection Dart.

---

## Theory
- [ ] List
- [ ] Set
- [ ] Map
- [ ] Queue

---

## Practice
- [ ] Shopping Cart
- [ ] Todo App
- [ ] Cache

---

## Quiz
- [ ] Quiz 1
- [ ] Quiz 2

---

## Final Project
- [ ] Inventory App

---

Progress: 30%
```

---

#### 4.3 Assessment Engine

**Deskripsi**: Memberikan evaluasi berbasis rubrik bukan sekadar jawaban benra/salah.

**Rubrik Penilaian**:
```
Nilai
-------
Theory: 90
Logic: 70
Coding: 95
Communication: 80
Best Practice: 85

Kesalahan terbesar:
Masih menganggap Queue sama dengan List.
```

**Flow Evaluasi**:
1. User menjawab soal/quiz
2. Sistem menganalisis jawaban
3. Memberikan rubrik detail + feedback spesifik
4. Menyimpan ke progress.json

---

#### 4.4 Progress Tracker

**Deskripsi**: Visualisasi progres belajar dengan sistem RPG-style per topik.

**Prinsip**: Progres bersifat **per topik**, bukan global. User bisa ahli di Flutter (80%) tapi baru mulai Compiler (10%). Setiap topik punya progres independen.

**Metrik yang Dilacak** (contoh per topik):
```
📊 Flutter             ████████░░  80%
📊 Dart Data Structure ██████░░░░░  60%
📊 Compiler            ██░░░░░░░░░░  20%
📊 Git                 ████████░░░░  70%
```

**Metrik Global** (rata-rata tertimbang):
```
Software Engineering    ██████░░░░░  40%
Knowledge               ██████████░░  80%
Practice                ████░░░░░░░░  40%
Architecture            ██░░░░░░░░░░  20%

XP: 1,250 / 2,000
Level: 5
```

**Implementasi**:
- File: `.codingschool/progress.json`
- Update real-time setiap sesi belajar — per item checklist di roadmap
- Persistensi antar sesi

---

#### 4.5 Session Resume

**Deskripsi**: Memungkinkan pengguna melanjutkan belajar dari checkpoint terakhir.

**Implementasi**:
- File: `.codingschool/sessions/YYYY-MM-DD.md`
- Menyimpan: topik aktif, progress saat ini, tahap Bloom terakhir, catatan sesi, checklist status
- Auto-load: ketika OpenCode dibuka dan user mengaktifkan Coach mode, Coach WAJIB membaca `.codingschool/sessions/` dan `.codingschool/progress.json` sebelum memberikan respons pertama

**Flow Resume**:
```
Tool call: cs_resume_session() → baca .codingschool/sessions/YYYY-MM-DD.md
Tool call: read .codingschool/progress.json
→ Coach: "Checkpoint terakhir: [topic], progress [X]%, Tahap [N]: [nama tahap].
   Status checklist: [✔] item1, [ ] item2.
   Lanjutkan dari sini?" 
```

---

### 5. Flow Siklus Belajar

```
User
  ↓
"Saya ingin belajar Data Structure"
  ↓
Coach (Intent Detection)
  ↓
"Apakah kamu ingin:
 A. Menyelesaikan pekerjaan
 B. Belajar membangun kemampuan?"
  ↓ (pilih B)
Generate Learning Plan
  ↓
Simpan roadmap/.codingschool/roadmap/dart/beginner.md
  ↓
Sesi Belajar (6 Tahap Bloom)
  ↓
Tahap 1: Remember - "Apa yang kamu pahami tentang Queue?"
Tahap 2: Understand - "Mengapa Queue cocok untuk printer?"
Tahap 3: Apply - "Implementasikan Queue"
Tahap 4: Analyze - "Apa kelemahan Queue?"
Tahap 5: Evaluate - "Bandingkan Queue vs Stack"
Tahap 6: Create - "Bangun aplikasi menggunakan Queue"
  ↓
Quiz & Coding Exercise
  ↓
Assessment Engine (Rubric)
  ↓
Update Progress
  ↓
Next Checkpoint
  ↓
Repeat
```

---

### 6. Spesifikasi Teknis

#### 6.1 Struktur Direktori Plugin
```
coding-school-plugin/
├── src/
│   ├── index.ts              # Entry point plugin
│   ├── coach.ts              # Logic intent detection
│   ├── roadmap/
│   │   └── generator.ts      # Learning plan generator
│   ├── assessment/
│   │   └── engine.ts         # Rubric assessment
│   ├── progress/
│   │   └── tracker.ts        # Progress management
│   └── session/
│       └── resume.ts         # Session persistence
├── package.json
├── tsconfig.json
└── README.md
```

#### 6.2 API Endpoints (Tools)

| Tool | Deskripsi | Args |
|------|-----------|------|
| `cs_create_roadmap` | Buat roadmap pembelajaran baru | topic, level |
| `cs_update_progress` | Update progress belajar | topic, item, status |
| `cs_assess_quiz` | Berikan penilaian rubrik | answers |
| `cs_resume_session` | Load sesi belajar sebelumnya | date |
| `cs_coach_dialog` | Mulai dialog dengan coach | choice (A/B) |

#### 6.3 Konfigurasi OpenCode

```jsonc
{
  "agent": {
    "coding-school": {
      "description": "Mentor pembelajaran software engineering",
      "prompt": "Kamu adalah mentor CodingSchool. Selalu tanyakan pilihan A/B...",
      "tools": { "write": false, "edit": false }
    }
  },
  "plugins": [
    "./coding-school-plugin"
  ]
}
```

---

#### 6.4 Tool Calling Behavior per Skenario

Setiap skenario percakapan memicu tool calling spesifik. Coach tidak boleh hanya merespon teks — harus membaca state `.codingschool/` dulu.

| Skenario User | Tool Call | Setelahnya |
|:---|---:|:---|
| "hi" (first time) | `cs_resume_session()` → file not found | Onboarding: tanya goal belajar |
| "hi" (existing) | `cs_resume_session()` + `read progress.json` | Resume: tampilkan checkpoint terakhir |
| "ingin belajar [topik]" | `cs_create_roadmap(topic, level)` | Generate `.codingschool/roadmap/<topic>/<level>.md` + respon dengan learning contract |
| "apakah saya harus buat [file]?" | `read .codingschool/roadmap/<topic>/<level>.md` | Cek apakah task sesuai plan. Jika tidak sesuai → arahkan ke roadmap |
| "saya faham tentang [konsep]" | `cs_assess_quiz()` + opsional `bash run [file]` | Verifikasi pemahaman, update progress, lanjut tahap Bloom berikutnya |
| "saya berhasil jalankan [file]" | `bash run [file]` + `cs_update_progress(topic, item, done)` | Verifikasi output, update checklist, beri XP |
| "saya siap lanjut" (session baru) | `cs_resume_session()` + `read progress.json` | Load checkpoint, tampilkan status, tanya lanjut |
| "[pertanyaan teknis]" | `read .codingschool/roadmap/<topic>/<level>.md` | Cek prerequisite. Jika ada yang belum → tolak explain. Jika aman → ajarkan |

---

### 7. Use Case

#### 7.1 Skenario: Belajar Data Structure
1. User: "Saya ingin belajar Data Structure di Dart"
2. Coach: "Apakah kamu ingin: A. Menyelesaikan pekerjaan B. Belajar membangun kemampuan?"
3. User: "B"
4. System: Buat `.codingschool/roadmap/dart/beginner.md`
5. User belajar melalui 6 tahap
6. System update progress.json
7. User keluar, OpenCode ditutup
8. Besok, user buka OpenCode → otomatis load sesi terakhir

---

### 8. Kriteria Keberhasilan

| Metric | Target |
|--------|--------|
| Accuracy intent detection | >90% |
| Completion rate learning path | >70% |
| User satisfaction (Coach) | >4.5/5 |
| Session resume success | 100% |

---

### 9. Dependencies Eksternal

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.0.0",
    "zod": "^3.22.0",
    "fs-extra": "^11.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

### 10. Timeline Pengembangan

| Sprint | Target | Deliverable |
|--------|--------|-------------|
| Sprint 1 | Setup & Core | Struktur plugin, Coach intent detection |
| Sprint 2 | Learning Plan | Roadmap generator, file persistence |
| Sprint 3 | Assessment | Rubric engine, progress tracker |
| Sprint 4 | Session | Resume functionality, testing |
| Sprint 5 | Docs & Release | README, v1.0 release |

---

### 11. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Konflik tool nama | Medium | Gunakan prefix `cs_` |
| Ketergantungan fs | High | Gunakan fs-extra, fallback manual |
| Context limit | Medium | Implementasi checkpoint kecil |

---

### 12. Appendix

#### 12.1 Contoh Output Assessment
```
=== Penilaian Quiz 1 ===

Theory: ████████░░ 90/100
Logic:  ███████░░░ 70/100
Coding: ██████████ 95/100
Communication: ████████░░ 80/100
Best Practice: █████████░ 85/100

Total: 82/100

Kesalahan terbesar:
Masih menganggap Queue sama dengan List.
Queue memiliki operasi FIFO, List memiliki operasi index-based.
```

#### 12.2 Contoh Output Progress RPG
```
Software Engineering    ██████░░░░░  40%
Knowledge               ██████████░░  80%
Practice                ████░░░░░░░░  40%
Architecture            ██░░░░░░░░░░  20%

XP: 1,250 / 2,000
Level: 5
```