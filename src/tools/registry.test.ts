import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { tool } from "@opencode-ai/plugin"

import plugin from "../index"
import { createToolRegistry } from "./registry"
import type { Platform, ToolDef } from "./types"
import surface from "../__fixtures__/opencode-surface.json"

const z = tool.schema
const PLATFORMS: Platform[] = ["opencode", "claude-code", "pi", "dsh", "mcp"]

// Registration order in v2.2.2 (src/index.ts at a24fd8d).
const V2_TOOL_ORDER = [
  "cs_coach_dialog", "cs_create_roadmap", "cs_update_progress", "cs_assess_quiz", "cs_prepare_capstone",
  "cs_resume_session", "cs_list_roadmap_items", "cs_diagnose_student", "cs_teach_concept", "cs_update_competency",
  "cs_reflect", "cs_code_review", "cs_architecture_review", "cs_grc_scan", "cs_mentoring_plan",
  "cs_engineering_status", "cs_timeline_init", "cs_timeline_add", "cs_timeline_update", "cs_timeline_list",
  "cs_project_scaffold", "cs_announce_project_complete", "cs_claim_open", "cs_claim_submit",
  "cs_check_requirements", "cs_init_learning_env", "cs_publish_handbook",
]

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cs-registry-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function describeTools(tools: Record<string, { description: string; args: Record<string, any> }>) {
  return Object.fromEntries(
    Object.entries(tools)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, t]) => [name, { description: t.description, args: z.toJSONSchema(z.object(t.args)) }]),
  )
}

describe("tool registry", () => {
  it("exposes the same 27 tools, descriptions and arg schemas as v2.2.2", () => {
    const registry = createToolRegistry({ projectDir: tmpDir, platform: "opencode" })
    const tools = Object.fromEntries(
      Object.entries(registry).map(([name, def]) => [name, { description: def.description, args: (def as ToolDef<any>).args(z) }]),
    )
    expect(Object.keys(tools)).toHaveLength(27)
    expect(describeTools(tools)).toEqual(surface.tools)
  })

  it("is platform independent in shape", () => {
    const names = (p: Platform) => Object.keys(createToolRegistry({ projectDir: tmpDir, platform: p })).sort()
    for (const p of PLATFORMS) expect(names(p)).toEqual(names("opencode"))
  })
})

describe("opencode adapter", () => {
  it("matches the v2.2.2 surface (tools + agents)", async () => {
    const hooks = await plugin.server({ directory: tmpDir } as any)
    const config: any = {}
    await hooks.config!(config)
    expect(describeTools(hooks.tool as any)).toEqual(surface.tools)
    expect(config.agent).toEqual(surface.agents)
  })

  it("keeps v2.2.2 registration and key order", async () => {
    const hooks = await plugin.server({ directory: tmpDir } as any)
    const config: any = {}
    await hooks.config!(config)
    expect(Object.keys(hooks.tool!)).toEqual(V2_TOOL_ORDER)
    expect(Object.keys(config.agent)).toEqual(["teacher", "coach"])
    for (const id of ["teacher", "coach"]) {
      expect(Object.keys(config.agent[id])).toEqual(["description", "prompt", "mode", "permission"])
      expect(Object.keys(config.agent[id].permission)).toEqual(["question", "cs_*", "write", "edit", "strreplace"])
    }
  })

  it("denies writes without an open claim and always allows question", async () => {
    const hooks = await plugin.server({ directory: tmpDir } as any)
    const ask = async (id: string) => {
      const output: any = {}
      await (hooks as any)["permission.ask"]({ id }, output)
      return output.status
    }
    expect(await ask("question")).toBe("allow")
    for (const id of ["write", "edit", "strreplace"]) expect(await ask(id)).toBe("deny")
    expect(await ask("bash")).toBeUndefined()
  })

  it("runs the coach claim flow end to end: open → write allowed → pass → write denied", async () => {
    const hooks = await plugin.server({ directory: tmpDir } as any)
    const T = hooks.tool as any
    const ask = async (id: string) => {
      const output: any = {}
      await (hooks as any)["permission.ask"]({ id }, output)
      return output.status
    }
    const projectName = "Todo App"
    await T.cs_timeline_init.execute({
      projectName,
      description: "A task app",
      techStack: "TypeScript",
      milestones: JSON.stringify([{ name: "MVP" }]),
    })
    await T.cs_timeline_add.execute({ projectName, type: "sprint", name: "Sprint 1", parentName: "MVP" })
    await T.cs_timeline_add.execute({ projectName, type: "epic", name: "Epic 1", parentName: "Sprint 1" })
    await T.cs_timeline_add.execute({ projectName, type: "task", name: "Build add", parentName: "Epic 1" })

    expect(await ask("write")).toBe("deny")
    await T.cs_claim_open.execute({ projectName, itemName: "Build add", files: JSON.stringify(["src/add.ts"]) })
    expect(await ask("write")).toBe("allow")
    expect(await ask("edit")).toBe("allow")

    await T.cs_claim_submit.execute({ projectName, itemName: "Build add", verdict: "pass" })
    expect(await ask("write")).toBe("deny")
  })
})

describe("platform switch hints in tool output", () => {
  const roadmap = "# Roadmap: python\n\n## Phase 1: Dasar\n- [ ] Variabel\n- [ ] Proyek 1: Kalkulator Tip 🚀\n\n## Final Project\n- [ ] Aplikasi Todo\n"

  it("uses each platform's own switch instruction", async () => {
    const expected: Record<Platform, string> = {
      opencode: "`opencode --agent coach`",
      "claude-code": "`claude --agent coach`",
      pi: "`/coach`",
      dsh: 'agent preset "coach"',
      mcp: 'prompt "coach"',
    }
    for (const platform of PLATFORMS) {
      const dir = mkdtempSync(join(tmpdir(), `cs-hint-${platform}-`))
      try {
        const registry = createToolRegistry({ projectDir: dir, platform })
        await registry.cs_create_roadmap.execute({ topic: "python", level: "beginner", content: roadmap })
        const out = await registry.cs_prepare_capstone.execute({ topic: "python", type: "capstone" })
        expect(out).toContain(expected[platform])
        if (platform !== "opencode") expect(out).not.toContain("opencode")
        const phase = await registry.cs_prepare_capstone.execute({ topic: "python", type: "phase" })
        expect(phase).toContain(expected[platform])
        if (platform !== "opencode") expect(phase).not.toContain("opencode")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })

  it("keeps the exact v2.2.2 student text on opencode", async () => {
    const registry = createToolRegistry({ projectDir: tmpDir, platform: "opencode" })
    await registry.cs_create_roadmap.execute({ topic: "python", level: "beginner", content: roadmap })
    const phase = await registry.cs_prepare_capstone.execute({ topic: "python", type: "phase" })
    expect(phase).toContain("Sekarang pindah ke agent **Coach** (dropdown agent, atau `opencode --agent coach`) untuk mengerjakan proyek")
    const capstone = await registry.cs_prepare_capstone.execute({ topic: "python", type: "capstone" })
    expect(capstone).toContain("Sekarang pindah ke agent **Coach** (dropdown agent, atau `opencode --agent coach`) untuk membangun proyek capstone")
    const done = await registry.cs_announce_project_complete.execute({ projectName: "Aplikasi Todo", summary: "done" })
    expect(done).toContain("Sekarang pindah kembali ke agent **Teacher** (dropdown agent, atau `opencode --agent teacher`) untuk menandai proyek selesai")
  })

  it("points back to Teacher with each platform's instruction", async () => {
    const expected: Record<Platform, string> = {
      opencode: "`opencode --agent teacher`",
      "claude-code": "`claude --agent teacher`",
      pi: "`/teacher`",
      dsh: 'agent preset "teacher"',
      mcp: 'prompt "teacher"',
    }
    for (const platform of PLATFORMS) {
      const dir = mkdtempSync(join(tmpdir(), `cs-back-${platform}-`))
      try {
        const registry = createToolRegistry({ projectDir: dir, platform })
        const out = await registry.cs_announce_project_complete.execute({ projectName: "Todo", summary: "done" })
        expect(out).toContain(expected[platform])
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })
})
