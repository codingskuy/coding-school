import { PERSONAS } from "../personas/definitions"
import { renderPrompt } from "../personas/prompts"
import type { Persona } from "../personas/types"

// Generates the Claude Code plugin files from the persona definitions, so the
// plugin never drifts from OpenCode. Written by `bun run gen:claude-code`.

export const PLUGIN_NAME = "codingschool"
export const MCP_SERVER_NAME = "cs"
export const MCP_TOOL_WILDCARD = `mcp__plugin_${PLUGIN_NAME}_${MCP_SERVER_NAME}__*`

// Tools a persona may use besides the cs_* MCP tools. Teacher never gets a
// tool that can write files (including Bash); Coach writes behind the hook.
const READ_TOOLS = ["Read", "Glob", "Grep", "AskUserQuestion", "WebSearch", "WebFetch", "TodoWrite"]
const WRITE_TOOLS = ["Write", "Edit", "NotebookEdit", "Bash"]

export function personaTools(persona: Persona): string[] {
  const tools = persona.writePolicy === "never" ? READ_TOOLS : [...READ_TOOLS, ...WRITE_TOOLS]
  return [...tools, MCP_TOOL_WILDCARD]
}

export function renderAgentFile(persona: Persona): string {
  return [
    "---",
    `name: ${persona.id}`,
    `description: ${JSON.stringify(persona.description)}`,
    `tools: ${personaTools(persona).join(", ")}`,
    "---",
    "",
    renderPrompt(persona.id, "claude-code"),
    "",
  ].join("\n")
}

export function renderManifest(version: string): string {
  const manifest = {
    name: PLUGIN_NAME,
    version,
    description: "CodingSchool — Teacher and Coach personas for learning software engineering (diagnosis-first teaching, claim-gated pair programming).",
    author: { name: "CodingSkuy" },
    license: "MIT",
    keywords: ["education", "mentor", "teacher", "coach"],
    agents: Object.values(PERSONAS).map(p => `./claude-code/agents/${p.id}.md`),
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: "node",
        args: ["${CLAUDE_PLUGIN_ROOT}/dist/mcp.js", "--platform", "claude-code"],
      },
    },
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit|NotebookEdit",
          hooks: [
            {
              type: "command",
              command: 'node "${CLAUDE_PLUGIN_ROOT}/dist/gate-check.js" --scope persona',
            },
          ],
        },
      ],
    },
  }
  return JSON.stringify(manifest, null, 2) + "\n"
}

export function renderPluginFiles(version: string): Record<string, string> {
  const files: Record<string, string> = { ".claude-plugin/plugin.json": renderManifest(version) }
  for (const persona of Object.values(PERSONAS)) {
    files[`claude-code/agents/${persona.id}.md`] = renderAgentFile(persona)
  }
  return files
}
