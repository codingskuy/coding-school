import { fileURLToPath } from "url"
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"

import { decideWrite } from "../gate/check"
import { PERSONAS } from "../personas/definitions"
import { renderPrompt } from "../personas/prompts"
import type { PersonaId } from "../personas/types"

// Pi adapter. Pi calls personas "modes": /teacher and /coach switch mid-session,
// /codingschool off leaves them. The cs_* tools come from the bundled MCP
// server (Pi has MCP built in); this extension only adds the persona prompt and
// enforces each persona's writePolicy. Nothing is active until a mode is chosen,
// so installing the package globally never changes other Pi sessions.

export const MCP_SERVER_NAME = "codingschool"
const STATE_ENTRY = "codingschool-mode"
const PROMPT_SECTION = "codingschool"

// Built-in Pi tools that change files. Teacher loses all of them (as in Claude
// Code); Coach keeps them, but write/edit need an open claim.
const FILE_WRITE_TOOLS = ["write", "edit"]
const TEACHER_BLOCKED_TOOLS = [...FILE_WRITE_TOOLS, "bash", "powershell"]

export interface PiExtensionOptions {
  // Absolute path of the MCP server bundle; defaults to dist/mcp.js next to this file.
  mcpServerPath?: string
}

export function createPiExtension(options: PiExtensionOptions = {}) {
  const mcpServerPath = options.mcpServerPath ?? fileURLToPath(new URL("./mcp.js", import.meta.url))

  return function codingSchoolExtension(pi: ExtensionAPI): void {
    let mode: PersonaId | undefined
    // Writer tools Teacher deactivated; only these are re-activated on leave,
    // so tools activated meanwhile (e.g. by MCP) are kept.
    let removedByTeacher: string[] = []

    function apply(next: PersonaId | undefined): void {
      if (next && !mode) {
        pi.registerMcpServer(MCP_SERVER_NAME, {
          command: process.execPath,
          args: [mcpServerPath, "--platform", "pi"],
          // The prompts call cs_* tools by name, so declare them to the model.
          exposure: "direct",
        })
      }
      if (!next && mode) pi.unregisterMcpServer(MCP_SERVER_NAME)

      if (next !== "teacher" && removedByTeacher.length > 0) {
        pi.setActiveTools([...new Set([...pi.getActiveTools(), ...removedByTeacher])])
        removedByTeacher = []
      }
      if (next === "teacher") {
        const active = pi.getActiveTools()
        const removed = active.filter(t => TEACHER_BLOCKED_TOOLS.includes(t))
        if (removed.length > 0) {
          pi.setActiveTools(active.filter(t => !TEACHER_BLOCKED_TOOLS.includes(t)))
          removedByTeacher = [...new Set([...removedByTeacher, ...removed])]
        }
      }
      mode = next
    }

    function switchTo(next: PersonaId | undefined, ctx: ExtensionContext): void {
      apply(next)
      pi.appendEntry(STATE_ENTRY, { mode: next ?? null })
      ctx.ui.notify(next ? `CodingSchool: mode ${next === "teacher" ? "Teacher" : "Coach"}` : "CodingSchool: off", "info")
    }

    for (const persona of Object.values(PERSONAS)) {
      pi.registerCommand(persona.id, {
        description: `CodingSchool — ${persona.description}`,
        handler: async (_args, ctx) => switchTo(persona.id, ctx),
      })
    }

    pi.registerCommand("codingschool", {
      description: "CodingSchool — show the current mode, or `/codingschool off` to leave Teacher/Coach",
      handler: async (args, ctx) => {
        if (args.trim() === "off") return switchTo(undefined, ctx)
        ctx.ui.notify(mode ? `CodingSchool: mode ${mode}` : "CodingSchool: off (use /teacher or /coach)", "info")
      },
    })

    pi.registerFlag("codingschool", {
      description: "Start in a CodingSchool mode: teacher or coach",
      type: "string",
    })

    // Restore the mode of a resumed session, or take it from --codingschool.
    pi.on("session_start", async (_event, ctx) => {
      let restored: PersonaId | undefined
      for (const entry of ctx.sessionManager.getEntries()) {
        if (entry.type === "custom" && entry.customType === STATE_ENTRY) {
          restored = (entry.data as { mode: PersonaId | null } | undefined)?.mode ?? undefined
        }
      }
      const flag = pi.getFlag("codingschool")
      const fromFlag = flag === "teacher" || flag === "coach" ? flag : undefined
      apply(restored ?? fromFlag)
    })

    pi.on("before_agent_start", async event => {
      const sections = (event.systemPromptOptions.sections ??= {})
      if (mode) sections[PROMPT_SECTION] = renderPrompt(mode, "pi")
      else delete sections[PROMPT_SECTION]
    })

    pi.on("tool_call", async (event, ctx) => {
      if (!mode) return undefined
      if (mode === "teacher" && TEACHER_BLOCKED_TOOLS.includes(event.toolName)) {
        return { block: true, reason: "CodingSchool: the teacher persona never changes files." }
      }
      if (FILE_WRITE_TOOLS.includes(event.toolName)) {
        const decision = decideWrite(ctx.cwd)
        if (!decision.allow) return { block: true, reason: decision.reason }
      }
      return undefined
    })
  }
}
