import { resolve } from "path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { migrate, isMigrationNeeded } from "../migration"
import { createToolRegistry } from "../tools/registry"
import type { Platform, ToolDef } from "../tools/types"
import { PERSONAS } from "../personas/definitions"
import { renderPrompt } from "../personas/prompts"
import { questionToolNote } from "../personas/platform-hints"

// MCP adapter: exposes the 27 cs_* tools and the Teacher/Coach personas (as
// MCP prompts) to any MCP host — Claude Code, Pi, DeepSeek Harness, Cursor, …

export const MCP_PLATFORMS = ["claude-code", "pi", "dsh", "mcp"] as const satisfies readonly Platform[]
export type McpPlatform = (typeof MCP_PLATFORMS)[number]

export interface McpServerOptions {
  projectDir: string
  platform: McpPlatform
  version: string
  // MCP stdio owns stdout; all diagnostics must go to stderr.
  log?: (message: string) => void
}

export function createMcpServer({ projectDir, platform, version, log = console.error }: McpServerOptions): McpServer {
  if (isMigrationNeeded(projectDir)) {
    const result = migrate(projectDir)
    if (result.migrated) log(`[CodingSchool] Migrated ${result.topics} topic(s) to v2.0 format.`)
  }

  const server = new McpServer(
    { name: "codingschool", version },
    { instructions: `CodingSchool learning tools (cs_*). ${questionToolNote(platform)}`.trim() },
  )
  const registry = createToolRegistry({ projectDir, platform })

  for (const [name, def] of Object.entries(registry) as [string, ToolDef<any>][]) {
    server.registerTool(name, { description: def.description, inputSchema: def.args(z) }, async (args: Record<string, unknown>) => {
      try {
        const text = await def.execute(args)
        return { content: [{ type: "text" as const, text }] }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        log(`[CodingSchool] ${name} failed: ${e instanceof Error && e.stack ? e.stack : message}`)
        return { isError: true, content: [{ type: "text" as const, text: `${name} failed: ${message}` }] }
      }
    })
  }

  for (const persona of Object.values(PERSONAS)) {
    server.registerPrompt(persona.id, { description: persona.description }, () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: renderPrompt(persona.id, platform) } }],
    }))
  }

  return server
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

// coding-school mcp [--project-dir <dir>] [--platform claude-code|pi|dsh|mcp]
export function resolveMcpOptions(
  argv: string[],
  env: Record<string, string | undefined>,
  cwd: string,
): { projectDir: string; platform: McpPlatform } {
  const projectDir = resolve(flag(argv, "--project-dir") ?? env.CODINGSCHOOL_PROJECT_DIR ?? cwd)
  const platform = flag(argv, "--platform") ?? env.CODINGSCHOOL_PLATFORM ?? "mcp"
  if (!(MCP_PLATFORMS as readonly string[]).includes(platform)) {
    throw new Error(`Unknown --platform "${platform}" (use ${MCP_PLATFORMS.join(", ")}).`)
  }
  return { projectDir, platform: platform as McpPlatform }
}
