import { type Plugin, type PluginModule, tool } from "@opencode-ai/plugin"

import { migrate, isMigrationNeeded } from "./migration"
import { createToolRegistry } from "./tools/registry"
import type { ToolDef } from "./tools/types"
import { PERSONAS } from "./personas/definitions"
import { renderPrompt } from "./personas/prompts"
import type { Persona } from "./personas/types"
import { decideWrite } from "./gate/check"

// OpenCode adapter: maps the platform-neutral tool registry and personas
// onto OpenCode's plugin hooks. Business logic lives in src/tools and below.

const WRITE_TOOLS = ["write", "edit", "strreplace"]

// OpenCode ships its own (older) zod as `tool.schema`. Schemas are built with it
// at runtime, so zod instances never mix; only the static types differ.
const hostZod = tool.schema as unknown as Parameters<ToolDef["args"]>[0]

function toOpencodeTool(def: ToolDef<any>) {
  return tool({
    description: def.description,
    args: def.args(hostZod) as Parameters<typeof tool>[0]["args"],
    execute: (args) => def.execute(args),
  })
}

function personaPermissions(persona: Persona): Record<string, string> {
  const write = persona.writePolicy === "never" ? "deny" : "allow"
  const permission: Record<string, string> = { question: "allow", "cs_*": "allow" }
  for (const id of WRITE_TOOLS) permission[id] = write
  return permission
}

const CodingSchoolPlugin: Plugin = async ({ directory }) => {
  const projectDir = directory || "."

  // Run migration on load if needed
  if (isMigrationNeeded(projectDir)) {
    const result = migrate(projectDir)
    if (result.migrated) {
      console.log(`[CodingSchool] Migrated ${result.topics} topic(s) to v2.0 format.`)
    }
  }

  const registry = createToolRegistry({ projectDir, platform: "opencode" })

  return {
    tool: Object.fromEntries(
      Object.entries(registry).map(([name, def]) => [name, toOpencodeTool(def)]),
    ),

    config: async (config) => {
      config.agent ??= {}

      // Teacher — diagnosis-first, scaffolded teaching. NEVER writes files.
      // Coach — engineering mentor with GRC. May write files inside the claim gate flow.
      for (const persona of Object.values(PERSONAS)) {
        const agent: NonNullable<typeof config.agent>[string] = {
          description: persona.description,
          prompt: renderPrompt(persona.id, "opencode"),
          mode: "primary",
        }
        agent.permission = personaPermissions(persona)
        config.agent[persona.id] = agent
      }
    },

    event: async () => {
      // no-op — .codingschool/ dirs created lazily by tools
    },

    "permission.ask": async (input, output) => {
      if (input.id === "question") {
        output.status = "allow"
        return
      }
      // Claim-gate enforcement: file writes are allowed ONLY while a
      // comprehension claim is open (cs_claim_open). This turns
      // "cs_claim_open BEFORE writing any code" from a prompt suggestion
      // into a system rule for the pair-programming workflow.
      if (WRITE_TOOLS.includes(input.id)) {
        output.status = decideWrite(projectDir).allow ? "allow" : "deny"
        return
      }
      // Everything else: defer to the agent permission maps / user.
    },
  }
}

export default {
  id: "coding-school",
  server: CodingSchoolPlugin,
} satisfies PluginModule
