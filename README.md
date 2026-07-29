<div align="center">

# 🎓 CodingSchool

### AI Engineering Mentor for OpenCode

**Two agents. One mission. Real understanding.**

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/codingskuy/codingschool)
[![Installs](https://img.shields.io/badge/installs-1,000-brightgreen?logo=npm)](https://www.npmjs.com/package/@codingskuy/coding-school)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-221%20passing-brightgreen.svg)](#development)
[![OpenCode](https://img.shields.io/badge/OpenCode-v0.7+-purple.svg)](https://opencode.ai)

---

✨ **We're thrilled — CodingSchool has reached 1,000 student installs!**  
*Thank you for your trust and learning spirit. 🚀*

---

*Stop copying code you don't understand.*

CodingSchool is a dual-agent OpenCode plugin that builds **real engineering skills** — not dependency on AI autocomplete.

</div>

---

## ✨ What's New in v2.1

```
┌─────────────────────────────────────────────────────────────────┐
│  v2.1 — The Installer & Project Timeline                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📦 ONE-COMMAND INSTALL          🗺️ COACH TIMELINE              │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  npm i @codingskuy/      │   │  Milestones → Sprints →  │   │
│  │  coding-school            │   │  Epics → Tasks           │   │
│  │  npx coding-school setup  │   │  Interactive Planner     │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
│  🧑‍🏫 AGENTS RENAMED              🚀 PI AGENT (SOON)           │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  LEARN  →  TEACHER       │   │  Architecture review +   │   │
│  │  (clearer identity)      │   │  Research-backed design  │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
│  🔗 1,000 INSTALLS             📦 Zero-dep CLI                 │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  Milestone reached!      │   │  Built-in setup wizard   │   │
│  │  Thank you, students!    │   │  No extra dependencies   │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
# One-command install + setup
npm i @codingskuy/coding-school
npx @codingskuy/coding-school setup

# Follow the prompts:
# • Enable Teacher (student mentor)
# • Enable Coach (project mentor)
# • Auto-registers in opencode.json plugin[]

# Then restart OpenCode and switch agent in the dropdown.
```

**Zero config needed.** Both agents auto-register with their tools, prompts, and permissions.

> Requires **OpenCode v0.7+** (Plugin V2 API).

---

## 🤖 The Agents

### Teacher — Student Mentor

```
┌─────────────────────────────────────────────────────┐
│  🧑‍🏫 TEACHER AGENT                                  │
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
│  │  Timeline   │  │  Code       │  │  Arch      │ │
│  │  Planning   │→ │  Review     │→ │  Review    │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
│                                                     │
│  Workflow: Planning → Feature Guidance → Review     │
│                                                     │
│  ✅ Guides project planning with milestones/sprints │
│  ✅ Flags security issues as CRITICAL               │
│  ✅ Connects issues to engineering competencies     │
│  ✅ Tracks growth across 8 dimensions               │
│  ✅ OWASP Top 10 compliance scanning                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Tools Reference

### Teacher Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `cs_diagnose_student` | Detect level, gaps, misconceptions | Start of new topic |
| `cs_teach_concept` | Scaffolded hints (5 levels) | During teaching |
| `cs_update_competency` | Update 4-dimension scores | After quizzing/teaching |
| `cs_reflect` | Session reflection prompts | End of session |
| `cs_list_roadmap_items` | List roadmap items + checkboxes | Before progress update |
| `cs_create_roadmap` | Generate learning roadmap | New topic setup |
| `cs_update_progress` | Mark items done, award XP, append narrative notes to learning handbook. Pass `notes` (Theory + Practice) to build a permanent learning journal | After each concept |
| `cs_assess_quiz` | Bloom's taxonomy rubric | Quiz time |
| `cs_resume_session` | Load last checkpoint | Session start |

### Coach Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `cs_timeline_init` | Initialize project timeline with milestones | Project kickoff |
| `cs_timeline_add` | Add epics/sprints/tasks to timeline | During planning |
| `cs_timeline_update` | Update timeline item status | Progress sync |
| `cs_timeline_list` | View full project timeline | Status review |
| `cs_project_scaffold` | Bootstrap project with full timeline, milestones & structure | Starting a new project |
| `cs_code_review` | Quality, security, best practices | Code shared by student |
| `cs_architecture_review` | Scalability, trade-offs | Design discussions |
| `cs_grc_scan` | OWASP, secrets, validation | Security concerns |
| `cs_mentoring_plan` | Personalized growth plan | Periodic check-in |
| `cs_engineering_status` | 8-dimension competency view | Progress review |
| `cs_coach_dialog` | Conversation interface | Legacy compatibility |

---

## 📖 Learning Handbook

Every time progress is recorded via `cs_update_progress`, a **learning handbook** is automatically generated in `.codingschool/handbook/`.

### Structure

```
.codingschool/handbook/
├── index.md              # Master index with links to all topics
└── java-programming.md   # Per-topic handbook
└── typescript.md         # (one per topic with progress)
```

### Per-Topic Handbook Contains

Each entry in the handbook is a **narrative learning journal** written by the AI mentor:

- Date and time of the session
- Material covered (roadmap item name)
- **Theory** — concise summary of concepts learned (definitions, rules, best practices)
- **Practice** — code examples, implementation steps, output
- Progress percentage

Example entry:
```
## 2026-07-29 14:30:00

**Topic:** Variables & Data Types

**Theory:**
Variables are containers for storing data in a program.
Data types determine the kind of value that can be stored:
- `int` — whole numbers
- `String` — text
- `boolean` — true/false

**Practice:**
```java
int age = 25;
String name = "Andi";
System.out.println(name + " is " + age + " years old");
```
Output: `Andi is 25 years old`

**Progress:** 60% complete
```

Students can open these markdown files directly to review their complete learning journey.

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
├── progress.json         # XP, level, per-topic progress
├── handbook/             # Auto-generated learning handbook
│   ├── index.md           # Master index of all topics
│   └── <topic>.md         # Per-topic handbook (progress, completed items, XP)
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
└── timeline/             # Coach project planning (epics, sprints, milestones)
    └── <project>.json

~/.config/opencode/codingschool/
└── student-model.json    # Global student model (persists across projects)
```

**Migration:** v1.x progress files auto-convert to v2.0 format on first load.

---

## 🔄 Learning Flow

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

## 🗺️ Coach Project Flow

```
  ┌──────────────────────────────────────────────────────────────┐
  │                  PROJECT GUIDANCE                            │
  └──────────────────────────────────────────────────────────────┘

  Student: "I want to build a REST API"
       │
       ▼
  ┌──────────────┐
  │  TIMELINE    │  Init milestones, sprints, epics, tasks
  │  INIT        │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  FEATURE     │  Guide implementation with code review
  │  GUIDANCE    │  + architecture assessment + GRC scan
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  REVIEW &    │  Review diff, update timeline status,
  │  REFLECT     │  log engineering competency growth
  └──────────────┘
```

---

## 🧪 Development

```bash
# Install dependencies
bun install

# Run all 221 tests
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
  ├── timeline/generator.test.ts 15 tests
  └── ... (7 more test files)
  ─────────────────────────────
  Total: 221 tests  ✅ 0 failures
```

---

## 📜 Changelog

### v2.1.0 — The Installer & Timeline (2026-07-29)

**🎉 1,000 Installs Milestone!**

**📦 New Installer:**
- One-command setup — `npm i @codingskuy/coding-school` then `npx coding-school setup`
- Interactive CLI with `opencode.json` auto-config
- Zero external dependencies (pure Node.js)
- Post-install welcome banner

**🧑‍🏫 Agent Rename:**
- `"Learn"` → `"Teacher"` for clearer identity
- All prompts, types, and tool names updated

**🗺️ Coach Timeline System:**
- `cs_timeline_init` — initialize project timeline
- `cs_timeline_add` — add epics, sprints, tasks
- `cs_timeline_update` — update status
- `cs_timeline_list` — view full timeline
- `cs_project_scaffold` — bootstrap project with full structure
- Coach workflow: Planning → Feature Guidance → Review

**🔧 Improvements:**
- 221 tests (up from 200)
- Renamed internal agent ID from `"learn"` to `"teacher"`
- Type-safe `CoachMode` discriminated union

### v2.0.0 — The Mentor Rewrite (2026-07-19)

**🚀 New Features:**
- Dual-agent system: Teacher (student mentor) + Coach (project mentor)
- Diagnosis-first teaching with misconception detection
- 5-level scaffolding: question → nudge → analogy → pseudocode → solution
- Per-topic competency tracking (4 dimensions)
- Engineering competency tracking (8 dimensions)
- Code review, architecture assessment, GRC scanning
- `cs_list_roadmap_items` for accurate progress tracking
- Fuzzy matching for roadmap checkbox updates
- Auto-migration from v1.x format

**🔧 Improvements:**
- 200 tests
- Enhanced TUI sidebar with competency visualization
- Bilingual content support (English + Indonesian)

**📦 Migration:**
- Automatic: `.codingschool/progress.json` → `student-model.json` + `competency.json`
- Backward compatible: legacy agent still works

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
