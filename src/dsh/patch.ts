import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"

import { PERSONAS } from "../personas/definitions"
import { renderPrompt } from "../personas/prompts"
import type { Persona } from "../personas/types"

// DeepSeek Harness adapter (developer preview, best effort). DSH has no MCP
// prompts, so each persona becomes an agent preset in a Cordis patch that the
// user loads with `dsh web --patch <file>`. Presets exist only in DSH Web and
// Desktop. The patch is JSON, which is valid YAML.

export const DSH_HOOKS_PACKAGE = "@deepseek-ai/dsh-hooks-claude-code"

export interface DshPaths {
  mcpServer: string // absolute path to dist/mcp.js
  gateCheck: string // absolute path to dist/gate-check.js
  coachHooks: string // absolute path to the generated Coach hooks.json
}

function presetPlugins(persona: Persona, paths: DshPaths): unknown[] {
  const writes = persona.writePolicy !== "never"
  const plugins: unknown[] = [
    { id: "persona", name: "@deepseek-ai/dsh-persona", config: { prefix: renderPrompt(persona.id, "dsh") } },
    { id: "agent-instructions", name: "@deepseek-ai/dsh-agent-instructions", config: { maxBytes: 65536 } },
    { id: "time-context", name: "@deepseek-ai/dsh-time-context" },
    // Teacher gets read-only file tools and no shell, so it has no way to write.
    {
      id: "tool-fs",
      name: "@deepseek-ai/dsh-tool-fs",
      config: writes ? { applyPatch: false } : { write: false, edit: false, applyPatch: false },
    },
    { id: "tool-fs-search", name: "@deepseek-ai/dsh-tool-fs-search" },
    {
      id: "codingschool-mcp",
      name: "@deepseek-ai/dsh-mcp-client",
      config: { serverName: "cs", transport: "stdio", command: "node", args: [paths.mcpServer, "--platform", "dsh"] },
    },
  ]
  if (writes) {
    plugins.push(
      { id: "tool-bash", name: "@deepseek-ai/dsh-tool-bash" },
      // Mounted inside the Coach preset, so it only sees Coach's tool calls.
      { id: "codingschool-gate", name: DSH_HOOKS_PACKAGE, config: { configPath: paths.coachHooks } },
    )
  }
  return plugins
}

export function renderDshPatch(paths: DshPaths): string {
  const presets = Object.values(PERSONAS).map((persona, i) => ({
    id: `preset-codingschool-${persona.id}`,
    name: "@deepseek-ai/dsh-agent-preset",
    config: {
      id: `codingschool-${persona.id}`,
      name: persona.id === "teacher" ? "Teacher" : "Coach",
      description: persona.description,
      order: 10 + i,
      plugins: presetPlugins(persona, paths),
    },
  }))
  return JSON.stringify([{ insert: presets }], null, 2) + "\n"
}

// Claude Code hooks format, run by DSH's hooks bridge. DSH sends no agent_type,
// so the persona is passed on the command line.
export function renderCoachHooks(paths: Pick<DshPaths, "gateCheck">): string {
  const hooks = {
    hooks: {
      PreToolUse: [
        { hooks: [{ type: "command", command: `node ${JSON.stringify(paths.gateCheck)} --persona coach` }] },
      ],
    },
  }
  return JSON.stringify(hooks, null, 2) + "\n"
}

// Writes the patch and hooks into <dir> and returns the patch path.
export function writeDshFiles(dir: string, dist: { mcpServer: string; gateCheck: string }): string {
  mkdirSync(dir, { recursive: true })
  const paths: DshPaths = { ...dist, coachHooks: join(dir, "coach-hooks.json") }
  const patchPath = join(dir, "codingschool.patch.yml")
  writeFileSync(paths.coachHooks, renderCoachHooks(paths))
  writeFileSync(patchPath, renderDshPatch(paths))
  return patchPath
}
