import { describe, it, expect, beforeEach, afterEach, beforeAll } from "bun:test"
import { mkdtempSync, rmSync, existsSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { spawnSync } from "child_process"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

import { createMcpServer, resolveMcpOptions, type McpPlatform } from "./server"
import { createToolRegistry } from "../tools/registry"
import { renderPrompt } from "../personas/prompts"
import surface from "../__fixtures__/opencode-surface.json"

const ROOT = resolve(import.meta.dir, "../..")
const DIST = join(ROOT, "dist", "mcp.js")

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cs-mcp-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

async function connect(projectDir: string, platform: McpPlatform = "mcp", log: (m: string) => void = () => {}) {
  const server = createMcpServer({ projectDir, platform, version: "test", log })
  const client = new Client({ name: "test", version: "0" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

function text(result: any): string {
  return result.content.map((c: any) => c.text).join("")
}

describe("MCP server: tools", () => {
  it("lists exactly the 27 cs_* tools with the v2.2.2 descriptions and arguments", async () => {
    const client = await connect(tmpDir)
    const { tools } = await client.listTools()
    expect(tools.map(t => t.name).sort()).toEqual(Object.keys(surface.tools).sort())
    for (const t of tools) {
      const expected = (surface.tools as Record<string, any>)[t.name]
      expect(t.description).toBe(expected.description)
      expect(t.inputSchema.properties ?? {}).toEqual(expected.args.properties ?? {})
      expect([...(t.inputSchema.required ?? [])].sort()).toEqual([...(expected.args.required ?? [])].sort())
    }
  })

  it("returns the same output as calling the handler directly", async () => {
    const roadmap = "# Roadmap: python\n\n## Phase 1: Dasar\n- [ ] Variabel\n- [ ] Proyek 1: Kalkulator Tip 🚀\n\n## Final Project\n- [ ] Aplikasi Todo\n"
    const calls: [string, Record<string, unknown>][] = [
      ["cs_create_roadmap", { topic: "python", level: "beginner", content: roadmap }],
      ["cs_list_roadmap_items", { topic: "python" }],
      ["cs_prepare_capstone", { topic: "python", type: "phase" }],
      ["cs_prepare_capstone", { topic: "python", type: "capstone" }],
      ["cs_announce_project_complete", { projectName: "Aplikasi Todo", topic: "python", summary: "done" }],
      ["cs_engineering_status", {}],
      ["cs_coach_dialog", { message: "hi" }],
    ]
    const directDir = mkdtempSync(join(tmpdir(), "cs-mcp-direct-"))
    try {
      const client = await connect(tmpDir, "claude-code")
      const registry = createToolRegistry({ projectDir: directDir, platform: "claude-code" }) as Record<string, any>
      for (const [name, args] of calls) {
        const viaMcp = text(await client.callTool({ name, arguments: args })).replaceAll(tmpDir, "<DIR>")
        const direct = String(await registry[name].execute(args)).replaceAll(directDir, "<DIR>")
        expect(viaMcp).toBe(direct)
      }
    } finally {
      rmSync(directDir, { recursive: true, force: true })
    }
  })

  it("rejects invalid arguments without running the handler", async () => {
    const client = await connect(tmpDir)
    const result: any = await client.callTool({ name: "cs_create_roadmap", arguments: { topic: "python", level: "guru" } })
    expect(result.isError).toBe(true)
    expect(existsSync(join(tmpDir, ".codingschool", "roadmap"))).toBe(false)
  })

  it("turns handler exceptions into readable isError results and logs to the logger", async () => {
    const logs: string[] = []
    const client = await connect(tmpDir, "mcp", m => logs.push(m))
    // A file where the .codingschool directory should be makes the write fail.
    await Bun.write(join(tmpDir, ".codingschool"), "not a directory")
    const result: any = await client.callTool({ name: "cs_create_roadmap", arguments: { topic: "python", level: "beginner", content: "# x" } })
    expect(result.isError).toBe(true)
    expect(text(result)).toStartWith("cs_create_roadmap failed:")
    expect(text(result)).not.toContain("    at ")
    expect(logs.join("\n")).toContain("cs_create_roadmap failed")
  })
})

describe("MCP server: personas as prompts", () => {
  it("exposes teacher and coach rendered for the host platform", async () => {
    const client = await connect(tmpDir, "pi")
    const { prompts } = await client.listPrompts()
    expect(prompts.map(p => p.name)).toEqual(["teacher", "coach"])
    for (const id of ["teacher", "coach"] as const) {
      const prompt = await client.getPrompt({ name: id })
      expect((prompt.messages[0].content as any).text).toBe(renderPrompt(id, "pi"))
    }
  })
})

describe("MCP server: instructions", () => {
  it("tells the host how to handle the question tool", async () => {
    const client = await connect(tmpDir, "claude-code")
    expect(client.getInstructions()).toContain("AskUserQuestion")
  })
})

describe("resolveMcpOptions", () => {
  it("resolves project dir and platform from flags, then env, then defaults", () => {
    expect(resolveMcpOptions([], {}, "/work")).toEqual({ projectDir: "/work", platform: "mcp" })
    expect(resolveMcpOptions([], { CODINGSCHOOL_PROJECT_DIR: "/env", CODINGSCHOOL_PLATFORM: "pi" }, "/work"))
      .toEqual({ projectDir: "/env", platform: "pi" })
    expect(resolveMcpOptions(["--project-dir", "/flag", "--platform", "claude-code"], { CODINGSCHOOL_PROJECT_DIR: "/env" }, "/work"))
      .toEqual({ projectDir: "/flag", platform: "claude-code" })
  })

  it("rejects platforms that are not MCP hosts", () => {
    expect(() => resolveMcpOptions(["--platform", "opencode"], {}, "/work")).toThrow("Unknown --platform")
  })
})

describe("MCP server: built stdio binary", () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      const build = spawnSync("bun", ["build", "src/mcp.ts", "--outdir", "dist", "--target", "node"], { cwd: ROOT })
      if (build.status !== 0) throw new Error(build.stderr.toString())
    }
  })

  it("speaks MCP over stdio via the coding-school CLI", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [join(ROOT, "scripts", "cli.mjs"), "mcp", "--project-dir", tmpDir, "--platform", "claude-code"],
      stderr: "pipe",
    })
    const client = new Client({ name: "test", version: "0" })
    await client.connect(transport)
    try {
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(27)
      const status = text(await client.callTool({ name: "cs_engineering_status", arguments: {} }))
      expect(status.length).toBeGreaterThan(0)
      expect(client.getServerVersion()?.name).toBe("codingschool")
    } finally {
      await client.close()
    }
  })

  it("exits with an error for an unknown platform", () => {
    const r = spawnSync("node", [DIST, "--platform", "nope"], { encoding: "utf-8", input: "" })
    expect(r.status).toBe(1)
    expect(r.stdout).toBe("")
    expect(r.stderr).toContain("Unknown --platform")
  })
})
