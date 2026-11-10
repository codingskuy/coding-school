import type { Platform } from "../tools/types"
import type { PersonaId } from "./types"

interface PlatformHints {
  // Shown to the student (Indonesian), e.g. "pindah ke ${student.coach}".
  student: Record<PersonaId, string>
  // Used inside the English system prompts.
  prompt: Record<PersonaId, string>
  // Prompts and tool outputs say "the question tool" (OpenCode's built-in).
  // Tells other hosts what to use instead; empty on OpenCode.
  questionTool: string
}

// OpenCode strings must stay byte-identical to v2.2.2 (see opencode-surface fixture).
// claude-code / pi verified in Phase 0; dsh / mcp are best-effort until Phase 6.
const HINTS: Record<Platform, PlatformHints> = {
  opencode: {
    student: {
      teacher: "agent **Teacher** (dropdown agent, atau `opencode --agent teacher`)",
      coach: "agent **Coach** (dropdown agent, atau `opencode --agent coach`)",
    },
    prompt: {
      teacher: "dropdown, or `opencode --agent teacher`",
      coach: 'open the agent dropdown and pick "coach", or run `opencode --agent coach`',
    },
    questionTool: "",
  },
  "claude-code": {
    student: {
      teacher: "agent **Teacher** (keluar dari sesi ini, lalu jalankan `claude --agent codingschool:teacher`)",
      coach: "agent **Coach** (keluar dari sesi ini, lalu jalankan `claude --agent codingschool:coach`)",
    },
    prompt: {
      teacher: "exit this session, then run `claude --agent codingschool:teacher`",
      coach: "exit this session, then run `claude --agent codingschool:coach`",
    },
    questionTool: "Wherever these instructions or a tool result say to use the \"question\" tool, use the AskUserQuestion tool.",
  },
  pi: {
    student: {
      teacher: "mode **Teacher** (ketik `/teacher`)",
      coach: "mode **Coach** (ketik `/coach`)",
    },
    prompt: {
      teacher: "type `/teacher`",
      coach: "type `/coach`",
    },
    questionTool: "This environment has no \"question\" tool. Wherever these instructions or a tool result say to use it, ask in plain text with numbered options and wait for the student's reply.",
  },
  dsh: {
    student: {
      teacher: 'mode **Teacher** (pilih agent preset "teacher")',
      coach: 'mode **Coach** (pilih agent preset "coach")',
    },
    prompt: {
      teacher: 'select the "teacher" agent preset',
      coach: 'select the "coach" agent preset',
    },
    questionTool: "Wherever these instructions or a tool result say to use the \"question\" tool, use this environment's interactive question tool if one exists; otherwise ask in plain text with numbered options and wait for the reply.",
  },
  mcp: {
    student: {
      teacher: 'mode **Teacher** (pilih prompt "teacher" di aplikasi agent-mu)',
      coach: 'mode **Coach** (pilih prompt "coach" di aplikasi agent-mu)',
    },
    prompt: {
      teacher: 'select the "teacher" prompt in your agent app',
      coach: 'select the "coach" prompt in your agent app',
    },
    questionTool: "Wherever these instructions or a tool result say to use the \"question\" tool, use your host's interactive question tool if one exists; otherwise ask in plain text with numbered options and wait for the reply.",
  },
}

export function studentSwitchHint(platform: Platform, target: PersonaId): string {
  return HINTS[platform].student[target]
}

export function questionToolNote(platform: Platform): string {
  return HINTS[platform].questionTool
}

export function promptSwitchHint(platform: Platform, target: PersonaId): string {
  return HINTS[platform].prompt[target]
}
