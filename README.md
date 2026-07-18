<div align="center">

# 🎓 CodingSchool

### AI Engineering Mentor for OpenCode

**Two agents. One mission. Real understanding.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/codingskuy/codingschool)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-200%20passing-brightgreen.svg)](#development)
[![OpenCode](https://img.shields.io/badge/OpenCode-v0.7+-purple.svg)](https://opencode.ai)

---

*Stop copying code you don't understand.*

CodingSchool is a dual-agent OpenCode plugin that builds **real engineering skills** — not dependency on AI autocomplete.

</div>

---

## ✨ What's New in v2.0

```
┌─────────────────────────────────────────────────────────────────┐
│  v2.0 — The Mentor Rewrite                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🧠 DUAL-AGENT SYSTEM          📊 COMPETENCY TRACKING          │
│  ┌───────────┐  ┌──────────┐   ┌──────────────────────────┐   │
│  │   LEARN   │  │  COACH   │   │  ★★★★★  5-Star Ratings   │   │
│  │  Student  │  │ Project  │   │  4 Dimensions + 8 Eng.   │   │
│  │  Mentor   │  │ Mentor   │   │  Per-Topic Scoring       │   │
│  └───────────┘  └──────────┘   └──────────────────────────┘   │
│                                                                 │
│  🔬 DIAGNOSIS-FIRST            🪜 SCAFFOLDING                  │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  Level 1: Socratic Q's   │   │  Question → Nudge →      │   │
│  │  Level 2: Guided Practice│   │  Analogy → Pseudocode →  │   │
│  │  Level 3: Build Projects │   │  Solution                 │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
│  🔒 GRC AWARENESS             🔄 AUTO-MIGRATION                │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  OWASP Top 10 Scanning   │   │  v1.x → v2.0 Seamless   │   │
│  │  Secret Detection        │   │  .codingschool/ Auto-    │   │
│  │  Input Validation        │   │  Upgrade on First Load   │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
# 1. Add to your opencode.json
{
  "plugin": ["@codingskuy/coding-school"]
}

# 2. Restart OpenCode

# 3. Switch to "Learn" or "Coach" agent in the selector
```

**Zero config.** Both agents auto-register with their tools, prompts, and permissions.

> Requires **OpenCode v0.7+** (Plugin V2 API).

---

## 🤖 The Agents

### Learn — Student Mentor

```
┌─────────────────────────────────────────────────────┐
│  🧠 LEARN AGENT                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Philosophy:                                        │
│  "Mentor optimizes long-term growth,                │
│   not short-term task completion."                  │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Diagnose   │  │  Scaffold   │  │  Reflect   │ │
│  │  Before     │→ │  During     │→ │  After     │ │
│  │  Teaching   │  │  Teaching   │  │  Session   │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                     │
│  ✅ Detects misconceptions before they become habits │
│  ✅ Escalates hints only when student is stuck      │
│  ✅ De-escalates when student succeeds              │
│  ✅ Bilingual content (EN + ID)                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Coach — Project Mentor

```
┌─────────────────────────────────────────────────────┐
│  🏗️  COACH AGENT                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Philosophy:                                        │
│  "Every code review is a teaching moment.           │
│   Every architecture decision has trade-offs."      │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Code       │  │  Arch       │  │  GRC       │ │
│  │  Review     │→ │  Review     │→ │  Scan      │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                     │
│  ✅ Flags security issues as CRITICAL               │
│  ✅ Connects issues to engineering competencies     │
│  ✅ Tracks growth across 8 dimensions               │
│  ✅ OWASP Top 10 compliance scanning                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Tools Reference

### Learn Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `cs_diagnose_student` | Detect level, gaps, misconceptions | Start of new topic |
| `cs_teach_concept` | Scaffolded hints (5 levels) | During teaching |
| `cs_update_competency` | Update 4-dimension scores | After quizzing/teaching |
| `cs_reflect` | Session reflection prompts | End of session |
| `cs_list_roadmap_items` | List roadmap items + checkboxes | Before progress update |
| `cs_create_roadmap` | Generate learning roadmap | New topic setup |
| `cs_update_progress` | Mark items done, award XP | After each concept |
| `cs_assess_quiz` | Bloom's taxonomy rubric | Quiz time |
| `cs_resume_session` | Load last checkpoint | Session start |

### Coach Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `cs_code_review` | Quality, security, best practices | Code shared by student |
| `cs_architecture_review` | Scalability, trade-offs | Design discussions |
| `cs_grc_scan` | OWASP, secrets, validation | Security concerns |
| `cs_mentoring_plan` | Personalized growth plan | Periodic check-in |
| `cs_engineering_status` | 8-dimension competency view | Progress review |
| `cs_coach_dialog` | Conversation interface | Legacy compatibility |

---

## 📊 Competency System

### Learning Competency (4 Dimensions)

```
  Knowledge        Implementation     Debugging         Teaching
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ ██████░░ │     │ ████░░░░ │     │ ███████░ │     │ ██░░░░░░ │
  │   72%    │     │   48%    │     │   85%    │     │   25%    │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘

  Combined: ★★★☆☆  (65/100)
```

### Engineering Competency (8 Dimensions)

```
  Code Quality      Architecture       Git Process       Testing
  ████████░░        ██████░░░░         ████░░░░░░        ██░░░░░░░░
       82%               63%               42%               21%

  Documentation     Collaboration      GRC Awareness     Risk Assessment
  ██████░░░░        █████████░         ████░░░░░░        ██████░░░░
       58%               88%               35%               65%
```

---

## 🪜 Scaffolding Levels

The agent **adapts** to the student in real-time:

```
  LEVEL 1              LEVEL 2              LEVEL 3
  Socratic Question    Guided Nudge         Analogy
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ "What do you │     │ "Try thinking│     │ "It's like a │
  │  think would  │     │  about it as │     │  restaurant —│
  │  happen if...│     │  a loop..."  │     │  ingredients  │
  │  ?"           │     │              │     │  + steps"    │
  └──────────────┘     └──────────────┘     └──────────────┘

  LEVEL 4              LEVEL 5
  Pseudocode           Full Solution
  ┌──────────────┐     ┌──────────────┐
  │ "Here's the  │     │ "Here's the  │
  │  logic in    │     │  complete    │
  │  plain text" │     │  code"       │
  └──────────────┘     └──────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  Rules:                                                 │
  │  • Start at Level 1, ALWAYS                              │
  │  • Escalate after 2+ failed attempts                    │
  │  • De-escalate when student succeeds                    │
  │  • Never skip levels                                    │
  └─────────────────────────────────────────────────────────┘
```

---

## 📁 Data Structure

```
.codingschool/
├── student-model.json    # Global student profile (cross-project)
├── competency.json       # Per-topic: knowledge/implementation/debugging/teaching
├── engineering.json      # 8-dimension engineering competency
├── progress.json         # Legacy XP + level (backward compatible)
├── roadmap/
│   ├── java/
│   │   └── beginner.md   # Checklist-style roadmap
│   ├── typescript/
│   │   ├── beginner.md
│   │   └── intermediate.md
│   └── git/
│       └── beginner.md
├── sessions/
│   ├── 2026-07-19.md
│   └── 2026-07-20.md
├── quizzes/
├── reports/
└── certificates/

~/.config/opencode/codingschool/
└── student-model.json    # Global student model (persists across projects)
```

**Migration:** v1.x progress files auto-convert to v2.0 format on first load.

---

## 🔄 How It Works

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    LEARNING SESSION                          │
  └──────────────────────────────────────────────────────────────┘

  Student: "I want to learn Java"
       │
       ▼
  ┌─────────────┐
  │  DIAGNOSE   │  "What's your experience level?"
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  ROADMAP    │  Generate 10-phase learning path
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │   TEACH     │ ←→ │  SCAFFOLD   │ ←→ │   QUIZ      │
  └──────┬──────┘     └─────────────┘     └──────┬──────┘
         │                                        │
         ▼                                        ▼
  ┌─────────────┐                         ┌─────────────┐
  │  CHECKPOINT │                         │  REFLECT    │
  └──────┬──────┘                         └──────┬──────┘
         │                                        │
         └──────────────┬─────────────────────────┘
                        ▼
                 ┌─────────────┐
                 │   COMPETENCY│  ★★★☆☆ Updated!
                 └─────────────┘
```

---

## 🧪 Development

```bash
# Install dependencies
bun install

# Run all 200 tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Quick build (no declarations)
bun run build:quick
```

### Test Coverage

```
  src/
  ├── student-model.test.ts      22 tests
  ├── competency.test.ts         24 tests
  ├── diagnosis.test.ts          15 tests
  ├── scaffolding.test.ts        13 tests
  ├── reflection.test.ts         19 tests
  ├── engineering.test.ts        19 tests
  ├── migration.test.ts          16 tests
  └── ... (7 more test files)
  ─────────────────────────────
  Total: 200 tests  ✅ 0 failures
```

---

## 📜 Changelog

### v2.0.0 — The Mentor Rewrite (2026-07-19)

**🚀 New Features:**
- Dual-agent system: Learn (student mentor) + Coach (project mentor)
- Diagnosis-first teaching with misconception detection
- 5-level scaffolding: question → nudge → analogy → pseudocode → solution
- Per-topic competency tracking (4 dimensions)
- Engineering competency tracking (8 dimensions)
- Code review, architecture assessment, GRC scanning
- `cs_list_roadmap_items` for accurate progress tracking
- Fuzzy matching for roadmap checkbox updates
- Auto-migration from v1.x format

**🔧 Improvements:**
- 200 tests (up from 184)
- Enhanced TUI sidebar with competency visualization
- Bilingual content support (English + Indonesian)

**📦 Migration:**
- Automatic: `.codingschool/progress.json` → `student-model.json` + `competency.json`
- Backward compatible: old `coding-school` agent still works

### v1.0.4 — Bug Fixes
- Sidebar checklist counting fix
- Session resume topic key fix

### v1.0.3 — Initial Stable Release

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Run tests (`bun test`)
4. Commit your changes (`git commit -m 'feat: add amazing feature'`)
5. Push to the branch (`git push origin feat/amazing-feature`)
6. Open a Pull Request

---

## 📄 License

MIT — see [LICENSE.md](LICENSE.md)

---

<div align="center">

**Built with ❤️ by [CodingSchool](https://github.com/codingskuy)**

*Stop memorizing. Start understanding.*

</div>
