<div align="center">

# 🎓 CodingSchool

### AI Engineering Mentor for OpenCode

**Two agents. One mission. Real understanding.**

[![Version](https://img.shields.io/badge/version-2.2.1-blue.svg)](https://github.com/codingskuy/codingschool)
[![Installs](https://img.shields.io/badge/installs-1,000-brightgreen?logo=npm)](https://www.npmjs.com/package/@codingskuy/coding-school)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Tests](https://img.shields.io/badge/tests-304%20passing-brightgreen.svg)](#development)
[![OpenCode](https://img.shields.io/badge/OpenCode-v0.7+-purple.svg)](https://opencode.ai)

---

✨ **We're thrilled — CodingSchool has reached 1,000 student installs!**  
*Thank you for your trust and learning spirit. 🚀*

---

*Stop copying code you don't understand.* https://codingskuy.github.io/codingschool

CodingSchool is a dual-agent OpenCode plugin that builds **real engineering skills** — not dependency on AI autocomplete.

</div>

---

## ✨ What's New in v2.2.1

```
┌─────────────────────────────────────────────────────────────────┐
│  v2.2.1 — Teacher ↔ Coach Capstone Handoff                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ CHECKBOX ROADMAPS          🔄 CAPSTONE HANDOFF              │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  Auto-converted to       │   │  Theory/Practice done    │   │
│  │  - [ ] checklist items   │   │  → Teacher → Coach       │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
│  🎯 CURRENT & LAST PROGRESS    🏁 PROJECT COMPLETE            │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  cs_list_roadmap_items   │   │  All milestones done      │   │
│  │  shows Current / Last    │   │  → Coach → Teacher        │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
│  🔒 CLAIM-GATE ENFORCED        🧹 COACH TOOL CLEANUP           │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  Writes denied unless a  │   │  Teacher-only tools       │   │
│  │  comprehension claim is  │   │  removed from Coach       │   │
│  │  open                    │   │                           │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
│  📖 304 TESTS                  🆕 cs_prepare_capstone         │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │  100% passing            │   │  + cs_announce_project_  │   │
│  │                          │   │  complete                │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The learning journey now flows end-to-end:** Teacher builds a checkbox roadmap and tracks Current/Last progress → hands the capstone to Coach → Coach builds the project with the professional workflow (claim gate enforced) → Coach records completion and sends the student back → Teacher closes the roadmap and reflects.

---

## 🚀 Quick Start

```bash
# One-command install + setup
npm i @codingskuy/coding-school
npx @codingskuy/coding-school setup

# Follow the prompts:
# • Enable Teacher (student mentor)
# • Enable Coach (project mentor)
# • Registers the plugin in your GLOBAL opencode.json plugin[]

# Then restart OpenCode and switch agent in the dropdown.
```

The installer targets your **global** OpenCode config, so CodingSchool works in every project. It auto-locates `opencode.json` per operating system:

| OS | Global config path |
|----|--------------------|
| macOS | `~/.config/opencode/opencode.json` |
| Linux | `~/.config/opencode/opencode.json` (or `$XDG_CONFIG_HOME/opencode/opencode.json` if set) |
| Windows | `%USERPROFILE%\.config\opencode\opencode.json` |

> Custom path? If `OPENCODE_CONFIG` is set, the installer uses that file instead.

If no global config exists yet, the installer prints **manual setup instructions** with a ready-to-paste snippet — create the file yourself, then restart OpenCode.

**Zero config needed.** Both agents auto-register with their tools, prompts, and permissions.

### Manual install

No config file yet? Create one at the path above for your OS and add:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@codingskuy/coding-school"]
}
```

Then restart OpenCode and switch agent in the dropdown.

> **Project-only?** Run `npx @codingskuy/coding-school setup --project` from inside a project to register CodingSchool in just that project's `opencode.json` (the installer only searches up to the nearest Git root, matching OpenCode's own behavior).

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
| `cs_prepare_capstone` | Hand the roadmap's Final Project to the Coach agent | All non-capstone items done |
| `cs_resume_session` | Load last checkpoint | Session start |

### Coach Tools

| Tool | Description | When to Use |
|------|-------------|-------------|
| `cs_timeline_init` | Initialize project timeline with milestones | Project kickoff |
| `cs_timeline_add` | Add epics/sprints/tasks to timeline | During planning |
| `cs_timeline_update` | Update timeline item status | Progress sync |
| `cs_timeline_list` | View full project timeline | Status review |
| `cs_project_scaffold` | Bootstrap project with full timeline, milestones & structure | Starting a new project |
| `cs_announce_project_complete` | Record a finished project so the Teacher can close the roadmap | All milestones done |
| `cs_claim_open` | Snapshot target files + mark timeline item as awaiting comprehension proof | Before Coach writes generated code |
| `cs_claim_submit` | Close a claim: `pass`, `fail` (re-explain at next level), `partial-pass-continue` (code stays, claim open), `revert` (roll back code). Pass `qa` for multi-turn comprehension evidence | After the comprehension gate |
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
├── context.json           # Shared Teacher ↔ Coach state (diagnosis, capstone, completion)
├── workflow.json          # Tool-call order validator (advisory warnings)
├── claims/                # Comprehension claim snapshots (claim gate)
│   └── <project>.json
├── logs/                  # Debug decision traces (YYYY-MM-DD.jsonl, rotated)
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
                 └──────┬──────┘
                        │
                        ▼   Final Project (capstone) reached?
                 ┌─────┴─────┐
                 │  YES      │ → Hand off to the COACH agent
                 │  ───────  │   (cs_prepare_capstone)
                 └───────────┘   → Coach builds it → project done
                                  → back to Teacher to close the roadmap
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
  │  FEATURE     │  Coach explains approach (simple language)
  │  GENERATION  │  → cs_claim_open (snapshot files)
  │  + CLAIM     │  → Coach writes the code
  │  GATE        │  → Comprehension questions (multi-turn) → verdict
  │              │     pass → claimed | partial → watch
  │              │     fail → re-explain | revert → code rolled back
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  REVIEW &    │  Review diff, update timeline status,
  │  REFLECT     │  log engineering competency growth
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  COMPLETION  │  All milestones done → ✅ PROJECT COMPLETE
  │  & HANDOFF   │  → cs_announce_project_complete (summary)
  │              │  → send the student back to Teacher
  └──────────────┘
```

### Capstone Handoff (v2.2.1)

The roadmap's **Final Project** section is the student's capstone, built with the Coach agent:

1. **Teacher** teaches all theory/practice items and tracks progress via `Current`/`Last completed`.
2. When non-capstone items are done, Teacher calls `cs_prepare_capstone` → directs the student to switch to the **Coach** agent (`opencode --agent coach`). Teacher never marks Final Project items done.
3. **Coach** sees the `CAPSTONE PROJECT READY` briefing and seeds Phase 1 of the professional workflow from it.
4. When all milestones are done, `cs_timeline_update` announces `✅ PROJECT COMPLETE`, Coach runs the final review and calls `cs_announce_project_complete`.
5. Coach directs the student back to the **Teacher** agent (`opencode --agent teacher`), who reads the project summary, marks the Final Project items done (with the summary as handbook notes), and closes the roadmap with a reflection.

### Comprehension Claim Gate

Coach writes code like a build agent, but the code is **not final until the user claims it**:

1. Coach calls `cs_claim_open` — snapshots the current state of every target file (new + existing).
2. Coach writes the generated code. **File writes are enforced at the system level**: `permission.ask` denies `write`/`edit`/`strreplace` while no comprehension claim is open — Coach literally cannot edit files outside a claim.
3. Coach asks **3-5 probing questions, multi-turn** (e.g. "Explain line X in your own words", then follow-ups tuned to the answers). Question banks scale with engineering level (junior → mid → senior).
4. Coach scores each answer (`correct` / `partial` / `incorrect`) and records them in the `qa` argument of `cs_claim_submit`. Aggregate confidence = 70% average + 30% weakest answer, so one lucky guess can't carry the gate.
5. Verdict via `cs_claim_submit`:
   - **`pass`** (confidence ≥ 75) — user proved understanding → code stays, timeline item → `done`, engineering competency bumps. A `pass` under 75 adds a note to keep watching that area.
   - **`partial-pass-continue`** (confidence 40-74) — code stays, claim stays open, timeline stays `in-progress`; Coach keeps watching the weak answers.
   - **`fail`** — attempts++, Coach re-explains at the next level (`junior` → `mid` → `senior`). A history of reverted claims or repeated failures caps re-explanation at `mid` (gentler pacing).
   - **`revert`** — generated code is rolled back (new files deleted, edited files restored), timeline item → `todo`.

Generated code is only considered done when claimed. If the user can't demonstrate understanding, Coach reverts — the code never silently becomes part of the project.

---

## 🤖 Agentic Workflow Layer

The dual-agent loop is wired with shared state and observability so Teacher and Coach don't work blind:

- **Shared context** (`.codingschool/context.json`) — Teacher announces diagnosis (active topic, misconceptions) and Coach writes review/claim findings (weak engineering dimensions, skill gaps, claimed level). Teacher's `cs_teach_concept` output includes a "Context from Coach" block; Coach's `cs_claim_open` output includes a "Context from Teacher" brief. Since v2.2.1 the context also carries the **capstone handoff** (`pendingCapstone`, phase → `project`) and the **project completion** (`completedProject` with the Coach's summary, phase → `done`), so Teacher always knows where the student is in the roadmap.
- **Checkbox roadmaps & progress** — roadmaps are normalized to `- [ ]`/`- [x]` checklists on creation; each topic tracks `currentItem` (first unfinished) and `lastCompletedItem`, surfaced by `cs_list_roadmap_items`, `cs_update_progress` and `cs_resume_session`.
- **Claim-gate enforcement** — `permission.ask` denies `write`/`edit`/`strreplace` while no comprehension claim is open, so Coach can only write inside the pair-programming claim flow.
- **Workflow validator** (`.codingschool/workflow.json`) — records tool calls and emits **advisory warnings** (never blocking) when the order is off, e.g. teaching a topic before diagnosis, or submitting a claim with no recorded `cs_claim_open`.
- **Decision traces** (`.codingschool/logs/YYYY-MM-DD.jsonl`) — debug-only internal logs (agent, tool, sanitized input, outcome, duration). Code, file lists, answers and notes are **never written**. Rotates at 500 lines.
- **Meta-learning** — the initial hint level is auto-tuned from learning history (struggling topics get more scaffolding, mastered topics less), and re-explanation level is capped for students with poor claim history.
- **Compressed memory** — `student-model.json` derives `frequentStruggles` (≤5 topics) and `learningVelocity` (fast/steady/slow from Bloom-stage progress), shown on `cs_resume_session`.

Trace the lifecycle of a claim: `cs_claim_open` → comprehension Q&A (recorded in `qa`) → `cs_claim_submit` (pass / partial-pass-continue / fail / revert). Every step lands in the shared context and the workflow log.

---

## 🧪 Development

```bash
# Install dependencies
bun install

# Run all 304 tests
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
  ├── student-model.test.ts        26 tests
  ├── competency.test.ts           24 tests
  ├── engineering.test.ts          21 tests
  ├── scaffolding.test.ts          19 tests
  ├── reflection.test.ts           19 tests
  ├── timeline/generator.test.ts   17 tests
  ├── coach-gate.test.ts           17 tests
  ├── diagnosis.test.ts            15 tests
  ├── progress/tracker.test.ts     14 tests
  ├── roadmap/generator.test.ts    13 tests
  ├── context.test.ts              13 tests
  └── ... (9 more test files)
  ─────────────────────────────
  Total: 304 tests  ✅ 0 failures
```

---

## 📜 Changelog

### v2.2.1 — Teacher ↔ Coach Capstone Handoff (2026-08-17)

**🔁 Full learning loop:**
- Teacher → Coach handoff: `cs_prepare_capstone` hands the roadmap's `## Final Project` to Coach (shared context carries the capstone briefing; Teacher directs the student to switch agents)
- Coach → Teacher handoff: `cs_announce_project_complete` records the finished project + summary; `cs_timeline_update` announces `✅ PROJECT COMPLETE` when all milestones are done; Coach directs the student back to Teacher
- Teacher closes the roadmap: reads the Coach's project summary, marks Final Project items done (summary becomes handbook notes), runs a closing reflection

**✅ Checkbox roadmaps & progress:**
- Roadmap content normalized to `- [ ]`/`- [x]` checklists on creation (numbered lists / bare bullets auto-converted, code fences untouched)
- `currentItem` + `lastCompletedItem` tracked per topic and shown by `cs_list_roadmap_items`, `cs_update_progress`, `cs_resume_session`
- `cs_list_roadmap_items` reads all level files (beginner/intermediate/expert)

**🔒 Enforcement & polish:**
- Claim gate enforced at system level — `permission.ask` denies file writes while no comprehension claim is open
- Coach tool list cleaned (Teacher-only roadmap/quiz tools removed)
- 304 tests (up from 286)

### v2.2.0 — Agentic Workflow Layer (2026-08-10)

**🤖 Agentic Workflow Layer:**
- Shared context (`.codingschool/context.json`) — Teacher and Coach exchange diagnosis, review findings, and skill gaps so neither works blind
- Workflow validator (`.codingschool/workflow.json`) — records tool calls and emits advisory warnings when the order is off (never blocking)
- Decision traces (`.codingschool/logs/YYYY-MM-DD.jsonl`) — debug-only logs, rotated at 500 lines
- Meta-learning — hint levels auto-tuned from learning history; re-explanation capped for weak claim history
- Compressed memory — `frequentStruggles` and `learningVelocity` derived for smarter resumes

**🧑‍🏫 Multi-turn Comprehension Gate:**
- 3-5 probing questions scaled by engineering level (junior → mid → senior)
- `qa` evidence in `cs_claim_submit` with aggregate confidence scoring
- New `partial-pass-continue` verdict

**🔧 Improvements:**
- 286 tests (up from 221)
- Legacy `coding-school` agent removed — only Teacher and Coach

### v2.1.2 — Comprehension Claim Gate (2026-08-08)

- Coach claim gate (pair-programming): `cs_claim_open` snapshots files, `cs_claim_submit` closes with `pass`/`fail`/`revert`
- Coach allowed to write/edit files inside the claim flow; Teacher remains read-only
- Simple-warm dialogue style for both agents
- CLI setup defaults to global scope with per-OS config paths + manual fallback

### v2.1.1 — English README polish

- Full English localization of handbook examples and metadata

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
