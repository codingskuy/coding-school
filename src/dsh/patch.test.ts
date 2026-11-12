import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { spawnSync } from "child_process"

import { renderDshPatch, renderCoachHooks, writeDshFiles, DSH_HOOKS_PACKAGE } from "./patch"
import { renderPrompt } from "../personas/prompts"

const ROOT = resolve(import.meta.dir, "../..")
const PATHS = { mcpServer: "/pkg/dist/mcp.js", gateCheck: "/pkg/dist/gate-check.js", coachHooks: "/home/.dsh/codingschool/coach-hooks.json" }

const presets = () => JSON.parse(renderDshPatch(PATHS))[0].insert as any[]
const plugin = (preset: any, id: string) => preset.config.plugins.find((p: any) => p.id === id)

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cs-dsh-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("DSH patch", () => {
  it("defines Teacher and Coach as agent presets with the dsh-rendered prompts", () => {
    const [teacher, coach] = presets()
    expect(teacher.name).toBe("@deepseek-ai/dsh-agent-preset")
    expect([teacher.config.id, coach.config.id]).toEqual(["codingschool-teacher", "codingschool-coach"])
    expect(plugin(teacher, "persona").config.prefix).toBe(renderPrompt("teacher", "dsh"))
    expect(plugin(coach, "persona").config.prefix).toBe(renderPrompt("coach", "dsh"))
  })

  it("gives both presets the cs_* tools from the bundled MCP server", () => {
    for (const preset of presets()) {
      expect(plugin(preset, "codingschool-mcp").config).toEqual({
        serverName: "cs", transport: "stdio", command: "node", args: ["/pkg/dist/mcp.js", "--platform", "dsh"],
      })
    }
  })

  it("leaves Teacher without any tool that can write files", () => {
    const [teacher] = presets()
    expect(plugin(teacher, "tool-fs").config).toEqual({ write: false, edit: false, applyPatch: false })
    expect(plugin(teacher, "tool-bash")).toBeUndefined()
    expect(plugin(teacher, "codingschool-gate")).toBeUndefined()
  })

  it("gates Coach's writes through the hooks bridge mounted in the Coach preset only", () => {
    const [, coach] = presets()
    expect(plugin(coach, "tool-fs").config).toEqual({ applyPatch: false })
    expect(plugin(coach, "codingschool-gate")).toEqual({
      id: "codingschool-gate", name: DSH_HOOKS_PACKAGE, config: { configPath: PATHS.coachHooks },
    })
  })

  it("never contains a {{ that DSH's persona template would expand", () => {
    for (const preset of presets()) expect(plugin(preset, "persona").config.prefix).not.toContain("{{")
  })
})

describe("DSH Coach hook", () => {
  it("runs gate-check as the coach persona on DSH's PreToolUse payload", () => {
    const dist = { mcpServer: join(ROOT, "dist", "mcp.js"), gateCheck: join(ROOT, "dist", "gate-check.js") }
    writeDshFiles(join(tmpDir, "cfg"), dist)
    const hooks = JSON.parse(readFileSync(join(tmpDir, "cfg", "coach-hooks.json"), "utf-8"))
    expect(hooks).toEqual(JSON.parse(renderCoachHooks(dist)))
    const command: string = hooks.hooks.PreToolUse[0].hooks[0].command

    // Exactly the fields DSH's hooks bridge sends (no agent_type).
    const payload = (tool_name: string) => JSON.stringify({
      session_id: "s", transcript_path: "", cwd: tmpDir, hook_event_name: "PreToolUse", tool_name, tool_input: {}, tool_use_id: "t",
    })
    const runHook = (tool: string) => spawnSync("sh", ["-c", command], { input: payload(tool), encoding: "utf-8" })

    for (const tool of ["write", "edit", "apply_patch", "str_replace_editor"]) expect(runHook(tool).status).toBe(2)
    expect(runHook("read").status).toBe(0)
    mkdirSync(join(tmpDir, ".codingschool", "claims"), { recursive: true })
    writeFileSync(join(tmpDir, ".codingschool", "claims", "x.json"), JSON.stringify({ status: "open" }))
    expect(runHook("write").status).toBe(0)
  })
})
