# CodingSchool

**Learn Software Engineering with AI, not From AI.**

CodingSchool is an OpenCode plugin that acts as a software engineering learning mentor. It focuses on developing conceptual understanding, not just automatic code generation.

## Installation

Add to `opencode.json`:

```jsonc
{
  "plugin": ["@codingskuy/coding-school"]
}
```

The plugin auto-registers the CodingSchool agent, system prompt, and tool permissions — no manual agent config needed.

> Requires OpenCode v0.7+ (uses Plugin V2 API with `experimental.chat.system.transform`).

## Tools

The plugin provides 5 tools that the Coach agent can call:

| Tool | Function | Arguments |
|------|----------|-----------|
| `cs_coach_dialog` | Start dialog with the coach | message, choice (optional) |
| `cs_create_roadmap` | Create a learning contract `.md` in `.codingschool/roadmap/` | topic, level |
| `cs_update_progress` | Update progress + XP + level | topic, item, status |
| `cs_assess_quiz` | Provide a rubric assessment based on answer analysis | answers, topic, stage |
| `cs_resume_session` | Load the previous session checkpoint | date (optional) |

## Data Structure

```
.codingschool/
├── profile.md              # User profile & goals
├── progress.json           # Per-topic progress + global + XP
├── roadmap/
│   ├── dart/
│   │   ├── beginner.md
│   │   ├── intermediate.md
│   │   └── expert.md
│   ├── rust/
│   └── flutter/
├── sessions/
│   ├── 2026-07-13.md
│   └── 2026-07-14.md
├── quizzes/
├── reports/
└── certificates/
```

## Development

```bash
bun install          # Install dependencies
bun run typecheck    # TypeScript check
bun run build        # Build to dist/
bun run build:quick  # Build without declarations (faster)
```

## License

MIT — see [LICENSE.md](LICENSE.md)
