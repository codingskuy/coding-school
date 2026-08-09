# Changelog

## 2.2.0 - 2026-08-10

### Added
- Agentic Workflow Layer: shared context (`.codingschool/context.json`), workflow validator (`.codingschool/workflow.json`), decision traces (`.codingschool/logs/YYYY-MM-DD.jsonl`, rotated at 500 lines)
- Meta-learning: hint levels auto-tuned from learning history; re-explanation level capped for students with repeated failed/reverted claims
- Compressed memory: `frequentStruggles` (≤5 topics) and `learningVelocity` (fast/steady/slow) derived and shown on `cs_resume_session`
- Multi-turn comprehension gate: 3-5 probing questions scaled by engineering level, with `qa` evidence and aggregate confidence scoring in `cs_claim_submit`
- `partial-pass-continue` verdict: code stays, claim stays open, timeline stays in-progress
- Question bank scales with engineering level (junior → mid → senior)

### Changed
- Removed legacy `coding-school` agent — only Teacher and Coach are registered
- `cs_claim_submit` accepts `qa` array for multi-turn comprehension evidence

### Fixed
- Reverted claims or repeated failures now cap re-explanation at `mid` level (gentler pacing)

## 2.1.2 - 2026-08-08

### Added
- Coach comprehension claim gate (pair-programming model): `cs_claim_open` snapshots target files (new + existing) and marks the timeline item as awaiting comprehension proof; `cs_claim_submit` closes a claim with `pass` (code stays + engineering competency bump), `fail` (attempts++ → re-explain at junior → mid → senior), or `revert` (roll back generated code — new files deleted, edited files restored, timeline → todo)
- Coach agent now allowed to write/edit files inside the claim flow; file-write enforcement moved to per-agent permission maps (Teacher remains read-only)
- Simple-warm dialogue style rule for both Teacher and Coach: plain language, real-life analogies, jargon explained in lay terms, short theory, aggressive-but-polite comprehension checks
- CLI setup defaults to global scope with per-OS config paths and manual-setup fallback when no config file exists

### Changed
- `COACH_SYSTEM_PROMPT` rewritten around the comprehension gate + engineering levels (junior/mid/senior)
- Timeline generator: task notes now persist correctly on JSON round-trip

## 1.0.4 - 2026-07-15

### Fixed
- `cs_resume_session` now falls back to `progress.json` when no session files exist — agent recognizes existing learning progress
- Sidebar progress percentage now calculated from actual `- [x]` checkboxes in roadmap `.md`, not a static `Progress:` line
- SYSTEM_PROMPT rule 12: agent must NOT call `cs_coach_dialog` for progress checks — only `cs_resume_session`

### Added
- `quizInstructions()` helper in templates — structured instructions for AI to present quizzes via `question` tool with batching
- SYSTEM_PROMPT rule 11: quizzes MUST use `question` tool, split into batches of 5

### Changed
- README rewritten in English with clearer structure and examples

## 1.0.3 - 2026-07-15

### Added
- CI/CD split: `ci.yml` (bun, push/PR to master) + `release.yml` (tag trigger, npm publish + GitHub Release)
- Removed `npm-deploy.yml` — replaced by `release.yml`

## 1.0.2 - 2026-07-15

### Fixed
- `cs_coach_dialog` loop guard — long messages and markdown content return "Content acknowledged" instead of generic responses
- SYSTEM_PROMPT rules 8-9: never pass teaching content to `cs_coach_dialog`, output teaching as text directly
- Progress tracking: enforce `## Theory`/`## Practice`/`## Quiz`/`## Final Project` section format (NOT `## Phase X`)
- `updateProgress()` handles items not in roadmap arrays gracefully (fallback to theory + completedTheory)
- Roadmap `.md` checklist sync: `- [ ]` → `- [x]` when `cs_update_progress` marks items done

### Changed
- Roadmap generator refactored: removed hardcoded `THEORY_TEMPLATES`, `PRACTICE_TEMPLATES`, `generateLearningContract()` — AI model generates full content via `content` parameter
- `cs_create_roadmap` accepts `content: string` for flexible AI-generated roadmaps

## 1.0.1 - 2026-01-14

### Fixed
- Sidebar now shows immediately when `.codingschool/` directory is created (no restart needed)
- Removed automatic creation of `.codingschool/` directories on session start - now created lazily by tools only
- Removed `mode: "primary"` from agent config - agent no longer hijacks default behavior
- Removed `experimental.chat.system.transform` hook - system prompt no longer injected into other agents
- Updated SYSTEM_PROMPT to explicitly ban all state-changing shell commands (git init/add/commit, mkdir, echo>, rm, brew, etc.)

### Changed
- Sidebar TUI plugin now registers slot unconditionally and uses polling to detect new data
- `buildCodingSchoolView` shows progress section even without roadmap `.md` files

### Added
- GitHub Actions workflow for automated NPM deployment on tag push

## 1.0.0 - 2025-01-13

### Initial Release
- Core CodingSchool agent with 5 tools
- Sidebar TUI plugin with roadmap and progress display
- Session resume and checkpoint functionality
- Quiz assessment engine with Bloom taxonomy rubric
