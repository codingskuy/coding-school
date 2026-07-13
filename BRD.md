Idemu menurutku **menyentuh masalah yang nyata**, bukan sekadar "plugin AI". Sekarang banyak orang bisa menghasilkan aplikasi karena LLM, tetapi **kemampuan membangun software** sering tertinggal. Mereka tahu *what to type*, tetapi tidak tahu *why*. Akibatnya, ketika AI salah, mereka ikut salah.

Kalau dianalogikan orang desa, sekarang banyak yang bisa nyetir traktor otomatis. Sawah memang tergarap. Tapi begitu traktor mogok, bingung semua. CodingSchool harus mengajari orang cara kerja mesinnya, bukan cuma cara menekan tombol Start.

---

# Visi

> **CodingSchool by CodingSkuy**
>
> Learn Software Engineering with AI, not From AI.

Bukan AI yang mengerjakan semuanya.

Tetapi AI yang mengubah cara seseorang belajar software engineering.

---

# Posisi Plugin

Daripada menjadi plugin biasa, aku membayangkannya seperti berikut.

```text
                OpenCode

      ┌────────────────────────┐
      │        Plan            │
      │        Build           │
      │        Coach ⭐         │
      └────────────┬───────────┘
                   │
      ┌────────────┴─────────────┐
      │     CodingSchool Core    │
      │                          │
      │ Learning Engine          │
      │ Roadmap Generator        │
      │ Assessment Engine        │
      │ Knowledge Tracker        │
      │ Progress Manager         │
      │ Reflection Engine        │
      └────────────┬─────────────┘
                   │
          .codingschool/
```

Yang menarik justru bukan agent "Coach", melainkan **Learning Engine** di belakangnya.

---

# Filosofi Coach

Coach tidak boleh langsung menjawab.

Coach selalu bertanya:

```
Apakah kamu ingin:

A. Menyelesaikan pekerjaan

atau

B. Belajar membangun kemampuan?
```

Karena dua tujuan itu berbeda.

Kalau memilih B, Coach mengambil alih.

---

# Flow Belajar

Aku membayangkan seperti ini.

```text
User

↓

Saya ingin belajar Data Structure

↓

Coach

↓

Deteksi intent

↓

Generate Learning Plan

↓

Simpan roadmap

↓

Belajar

↓

Quiz

↓

Coding Exercise

↓

Review

↓

Score

↓

Next checkpoint

↓

Repeat
```

---

# Struktur Folder

Ini menurutku jauh lebih scalable.

```text
.codingschool/

    profile.md

    progress.json

    roadmap/

        dart/

            beginner.md

            intermediate.md

            expert.md

        flutter/

        git/

        architecture/

        testing/

    sessions/

        2026-07-13.md

        2026-07-14.md

    quizzes/

    reports/

    certificates/

```

Daripada

```
beginner/example.md
```

lebih baik dipisahkan berdasarkan domain.

Nanti ketika jumlah roadmap sudah ratusan tidak berantakan.

---

# Session Pertama

Misalnya user berkata

```
Saya ingin belajar Data Structure di Dart
```

Coach tidak langsung mengajar.

Dia melakukan onboarding.

```
Saya akan menjadi mentor Anda.

Topik:
✔ Dart Data Structure

Estimasi:

Beginner
≈ 25k context

Intermediate
≈ 80k context

Expert
≈ 250k context

Pilih level.
```

Ini menarik karena user tahu sejak awal investasi konteks yang dibutuhkan.

---

# Setelah Memilih

Misalnya Beginner.

Coach membuat

```
.codingschool/

roadmap/

dart/

beginner.md
```

Isinya bukan hanya roadmap.

Tetapi seperti Learning Contract.

---

```markdown
# Dart Data Structure

Status

🟨 In Progress

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

Progress

30%
```

---

# Yang Menurutku Sangat Penting

Banyak AI sekarang hanya:

```
Theory

↓

Code

↓

Done
```

Padahal belajar tidak begitu.

Aku justru membuat siklus seperti Bloom Taxonomy.

```text
Remember

↓

Understand

↓

Apply

↓

Analyze

↓

Evaluate

↓

Create
```

Jadi setiap materi selalu melewati keenam tahap.

---

# Contoh Siklus

Misalnya belajar Queue.

Coach:

## Tahap 1

```
Apa yang kamu pahami tentang Queue?
```

---

Tahap 2

```
Mengapa Queue cocok untuk printer?
```

---

Tahap 3

```
Implementasikan Queue.
```

---

Tahap 4

```
Apa kelemahan Queue?
```

---

Tahap 5

```
Bandingkan Queue vs Stack.
```

---

Tahap 6

```
Bangun aplikasi menggunakan Queue.
```

Itu baru benar-benar belajar.

---

# Assessment Engine

Ini menurutku fitur paling unik.

Setelah user menjawab.

Coach tidak hanya bilang

```
Benar.
```

Tetapi memberi rubrik.

```text
Nilai

Theory

90

Logic

70

Coding

95

Communication

80

Best Practice

85
```

Lalu

```
Kesalahan terbesar:

Masih menganggap Queue sama dengan List.
```

Jadi seperti dosen.

---

# Progress Tracking

Daripada hanya checklist.

Aku membuat seperti RPG.

```
Software Engineering

██████░░░░░

40%

Knowledge

████████░░

80%

Practice

████░░░░░░

40%

Architecture

██░░░░░░░░

20%
```

Ini akan membuat belajar jauh lebih menyenangkan.

---

# Coach Tidak Selalu Memberi Jawaban

Ini yang menurutku menjadi pembeda.

Misalnya user bertanya.

```
Bagaimana membuat Binary Search?
```

Coach tidak langsung menjawab.

Dia mengecek.

```
Apakah Binary Search ada di roadmap?

Ya.

Sudah menyelesaikan Sorting?

Belum.
```

Lalu.

```
Saya tidak akan menjelaskan Binary Search sekarang.

Selesaikan Sorting terlebih dahulu.

Karena Binary Search akan lebih mudah dipahami setelahnya.
```

Ini justru perilaku mentor manusia.

---

# Kritik terhadap Konsep Awalmu

Ada dua hal yang menurutku masih kurang.

**Pertama**, kamu masih memandang belajar sebagai **percakapan**. Padahal percakapan hanya medianya. Yang perlu dibangun adalah **state pembelajaran**: apa yang sudah dipelajari, apa yang belum, kesalahan yang sering muncul, dan target berikutnya. Semua itu sebaiknya tersimpan dan terus diperbarui.

**Kedua**, level Beginner–Intermediate–Expert saja belum cukup. Seseorang bisa ahli di Flutter tetapi baru mulai belajar Compiler atau Kubernetes. Jadi progres perlu bersifat **per topik**, bukan satu level global.

---

Kalau aku diminta merancang versi **v1.0** yang realistis, fokusnya hanya pada lima komponen inti:

1. **Coach Agent** sebagai mode baru di OpenCode.
2. **Learning Plan Generator** yang membuat roadmap Markdown di `.codingschool/roadmap/`.
3. **Progress Tracker** yang memperbarui checklist, skor, dan status belajar.
4. **Assessment Engine** untuk kuis, tugas praktik, evaluasi, dan umpan balik berbasis rubrik.
5. **Session Resume** yang memungkinkan pengguna menutup OpenCode hari ini lalu besok melanjutkan tepat dari checkpoint terakhir.

