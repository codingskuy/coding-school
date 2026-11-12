import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"

import { createPiExtension, MCP_SERVER_NAME } from "./extension"
import { renderPrompt } from "../personas/prompts"
import pkg from "../../package.json"

const ROOT = resolve(import.meta.dir, "../..")

// Minimal stand-in for Pi's ExtensionAPI, recording what the extension does.
function fakePi(options: { flag?: string; entries?: unknown[] } = {}) {
  const handlers: Record<string, (event: any, ctx: any) => any> = {}
  const commands: Record<string, { handler: (args: string, ctx: any) => Promise<void> }> = {}
  const state = {
    active: ["read", "bash", "edit", "write"],
    servers: {} as Record<string, any>,
    entries: [...(options.entries ?? [])] as any[],
    notices: [] as string[],
  }
  const pi: any = {
    on: (event: string, handler: any) => { handlers[event] = handler },
    registerCommand: (name: string, def: any) => { commands[name] = def },
    registerFlag: () => {},
    getFlag: () => options.flag,
    appendEntry: (customType: string, data: unknown) => state.entries.push({ type: "custom", customType, data }),
    getActiveTools: () => [...state.active],
    setActiveTools: (names: string[]) => { state.active = [...names] },
    registerMcpServer: (name: string, config: unknown) => {
      state.servers[name] = config
      state.active.push(`mcp__${name}__cs_engineering_status`)
    },
    unregisterMcpServer: (name: string) => {
      delete state.servers[name]
      state.active = state.active.filter(t => !t.startsWith(`mcp__${name}__`))
    },
  }
  return { pi, handlers, commands, state }
}

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cs-pi-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function setup(options: { flag?: string; entries?: unknown[] } = {}) {
  const fake = fakePi(options)
  createPiExtension({ mcpServerPath: "/x/dist/mcp.js" })(fake.pi)
  const ctx = {
    cwd: tmpDir,
    ui: { notify: (m: string) => fake.state.notices.push(m) },
    sessionManager: { getEntries: () => fake.state.entries },
  }
  const run = (name: string, args = "") => fake.commands[name].handler(args, ctx)
  const toolCall = (toolName: string) => fake.handlers.tool_call({ toolName, input: {} }, ctx)
  const promptSections = async () => {
    const event = { systemPromptOptions: { sections: {} as Record<string, string> } }
    await fake.handlers.before_agent_start(event, ctx)
    return event.systemPromptOptions.sections
  }
  return { ...fake, ctx, run, toolCall, promptSections }
}

function openClaim(): void {
  mkdirSync(join(tmpDir, ".codingschool", "claims"), { recursive: true })
  writeFileSync(join(tmpDir, ".codingschool", "claims", "todo.json"), JSON.stringify({ status: "open" }))
}

describe("Pi extension: inactive by default", () => {
  it("registers /teacher, /coach and /codingschool", () => {
    const { commands } = setup()
    expect(Object.keys(commands).sort()).toEqual(["coach", "codingschool", "teacher"])
  })

  it("changes nothing until a mode is chosen", async () => {
    const { toolCall, promptSections, state, handlers, ctx } = setup()
    await handlers.session_start({}, ctx)
    expect(await toolCall("write")).toBeUndefined()
    expect(await promptSections()).toEqual({})
    expect(state.servers).toEqual({})
    expect(state.active).toEqual(["read", "bash", "edit", "write"])
  })
})

describe("Pi extension: teacher mode", () => {
  it("adds the Teacher prompt, the MCP server, and removes every writer tool", async () => {
    const { run, promptSections, state } = setup()
    await run("teacher")
    expect((await promptSections()).codingschool).toBe(renderPrompt("teacher", "pi"))
    expect(state.servers[MCP_SERVER_NAME]).toEqual({
      command: process.execPath,
      args: ["/x/dist/mcp.js", "--platform", "pi"],
      exposure: "direct",
    })
    expect(state.active).toEqual(["read", `mcp__${MCP_SERVER_NAME}__cs_engineering_status`])
  })

  it("blocks writers even with an open claim", async () => {
    const { run, toolCall } = setup()
    openClaim()
    await run("teacher")
    for (const tool of ["write", "edit", "bash", "powershell"]) {
      expect(await toolCall(tool)).toEqual({ block: true, reason: expect.stringContaining("teacher") })
    }
    expect(await toolCall("read")).toBeUndefined()
  })
})

describe("Pi extension: coach mode", () => {
  it("gates write/edit on an open claim", async () => {
    const { run, toolCall } = setup()
    await run("coach")
    expect(await toolCall("write")).toEqual({ block: true, reason: expect.stringContaining("cs_claim_open") })
    expect(await toolCall("edit")).toEqual({ block: true, reason: expect.stringContaining("cs_claim_open") })
    openClaim()
    expect(await toolCall("write")).toBeUndefined()
  })

  it("restores the writer tools Teacher removed, keeping the MCP tools", async () => {
    const { run, state, promptSections } = setup()
    await run("teacher")
    await run("coach")
    expect(state.active.sort()).toEqual(["bash", "edit", `mcp__${MCP_SERVER_NAME}__cs_engineering_status`, "read", "write"])
    expect((await promptSections()).codingschool).toBe(renderPrompt("coach", "pi"))
  })
})

describe("Pi extension: leaving and restoring", () => {
  it("/codingschool off removes the prompt, the server and the gate", async () => {
    const { run, toolCall, promptSections, state } = setup()
    await run("teacher")
    await run("codingschool", "off")
    expect(await promptSections()).toEqual({})
    expect(state.servers).toEqual({})
    expect(state.active.sort()).toEqual(["bash", "edit", "read", "write"])
    expect(await toolCall("write")).toBeUndefined()
  })

  it("persists the mode and restores it on session_start", async () => {
    const first = setup()
    await first.run("coach")
    const resumed = setup({ entries: first.state.entries })
    await resumed.handlers.session_start({}, resumed.ctx)
    expect((await resumed.promptSections()).codingschool).toBe(renderPrompt("coach", "pi"))
  })

  it("starts in the mode given by --codingschool", async () => {
    const { handlers, ctx, promptSections, state } = setup({ flag: "teacher" })
    await handlers.session_start({}, ctx)
    expect((await promptSections()).codingschool).toBe(renderPrompt("teacher", "pi"))
    expect(state.active).not.toContain("write")
  })

  it("ignores an invalid --codingschool value", async () => {
    const { handlers, ctx, promptSections } = setup({ flag: "principal" })
    await handlers.session_start({}, ctx)
    expect(await promptSections()).toEqual({})
  })
})

describe("Pi package manifest", () => {
  it("declares the built extension for Pi", () => {
    expect(pkg.pi).toEqual({ extensions: ["./dist/pi.js"] })
  })

  it("does not bundle Pi's own packages", () => {
    const bundle = readFileSync(join(ROOT, "dist", "pi.js"), "utf-8")
    expect(bundle).not.toContain("@earendil-works")
  })
})
