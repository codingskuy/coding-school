# Changelog

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