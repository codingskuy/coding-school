import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { openClaim, submitClaim, updateEngineeringFromClaim } from "./coach-gate"
import { initTimeline, addTimelineItem, updateTimelineItem, loadTimeline } from "./timeline/generator"
import { ensureDir, readJson } from "./utils/fs"
import { dirname } from "path"
import { claimPath } from "./utils/paths"
import type { ClaimRecord } from "./utils/types"

let tmpDir: string
const projectName = "Todo App"

function initProject(): void {
  initTimeline({
    projectDir: tmpDir,
    projectName,
    description: "A task management app",
    techStack: ["React", "Node.js"],
    milestones: [{ name: "MVP" }],
  })
  addTimelineItem({ projectDir: tmpDir, projectName, type: "sprint", name: "Sprint 1", parentName: "MVP" })
  addTimelineItem({ projectDir: tmpDir, projectName, type: "epic", name: "Epic 1", parentName: "Sprint 1" })
  addTimelineItem({ projectDir: tmpDir, projectName, type: "task", name: "Buat fungsi add", parentName: "Epic 1" })
}

function writeTargetFile(relPath: string, content: string): string {
  const abs = join(tmpDir, relPath)
  ensureDir(dirname(abs))
  writeFileSync(abs, content, "utf-8")
  return abs
}

function loadClaims(): ClaimRecord | null {
  return readJson<ClaimRecord | null>(claimPath(tmpDir, projectName), null)
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
  initProject()
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("openClaim", () => {
  it("snapshots existing and new files, marks timeline item in-progress", () => {
    const existingPath = writeTargetFile("lib/todo.ts", "export const todos: string[] = []")
    const newPath = join(tmpDir, "lib", "add.ts")

    const result = openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [existingPath, newPath],
    })

    expect(result).toContain("Claim dibuka")
    const claim = loadClaims()
    expect(claim?.status).toBe("open")
    expect(claim?.files).toHaveLength(2)
    const existing = claim?.files.find(f => f.path === existingPath)
    expect(existing?.existed).toBe(true)
    expect(existing?.originalContent).toBe("export const todos: string[] = []")
    const fresh = claim?.files.find(f => f.path === newPath)
    expect(fresh?.existed).toBe(false)

    const timeline = loadTimeline(tmpDir, projectName)
    expect(timeline?.milestones[0].sprints[0].epics[0].tasks[0].status).toBe("in-progress")
  })

  it("rejects when no files are provided", () => {
    const result = openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [],
    })
    expect(result).toContain("at least one file")
  })

  it("rejects when project timeline does not exist", () => {
    const result = openClaim({
      projectDir: tmpDir,
      projectName: "Ghost Project",
      itemName: "Task X",
      files: [join(tmpDir, "x.ts")],
    })
    expect(result).toContain("not found")
  })

  it("rejects a second open claim while one is active", () => {
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [join(tmpDir, "add.ts")],
    })
    const result = openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [join(tmpDir, "add.ts")],
    })
    expect(result).toContain("already an open claim")
  })
})

describe("submitClaim", () => {
  it("pass — keeps files, closes claim, marks timeline done, bumps engineering competency", () => {
    const target = writeTargetFile("lib/add.ts", "export function add(a: number, b: number) { return a + b }")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })
    writeFileSync(target, "export function add(a: number, b: number) { return a + b } // generated", "utf-8")

    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "pass",
      level: "mid",
    })

    expect(result).toContain("di-claim")
    expect(result).toContain("Mid")
    expect(readFileSync(target, "utf-8")).toContain("// generated")

    const claim = loadClaims()
    expect(claim?.status).toBe("claimed")
    expect(claim?.successLevel).toBe("mid")

    const timeline = loadTimeline(tmpDir, projectName)
    expect(timeline?.milestones[0].sprints[0].epics[0].tasks[0].status).toBe("done")

    const engineering = readJson<{ collaboration: number; documentation: number; codeQuality: number }>(
      join(tmpDir, ".codingschool", "engineering.json"),
      { collaboration: 0, documentation: 0, codeQuality: 0 },
    )
    expect(engineering.collaboration).toBe(4)
    expect(engineering.documentation).toBe(2)
    expect(engineering.codeQuality).toBe(2)
  })

  it("fail — increments attempts and keeps claim open", () => {
    const target = writeTargetFile("lib/add.ts", "")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })

    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "fail",
    })

    expect(result).toContain("percobaan ke-1")
    expect(result).toContain("Mid")
    const claim = loadClaims()
    expect(claim?.status).toBe("open")
    expect(claim?.attempts).toBe(1)
  })

  it("fail escalates to senior on second attempt", () => {
    const target = writeTargetFile("lib/add.ts", "")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })
    submitClaim({ projectDir: tmpDir, projectName, itemName: "Buat fungsi add", verdict: "fail" })

    const result = submitClaim({ projectDir: tmpDir, projectName, itemName: "Buat fungsi add", verdict: "fail" })
    expect(result).toContain("Senior")
    expect(loadClaims()?.attempts).toBe(2)
  })

  it("revert — deletes new files, restores existing files, marks timeline todo", () => {
    const existingPath = writeTargetFile("lib/todo.ts", "export const todos: string[] = []")
    const newPath = join(tmpDir, "lib", "generated.ts")

    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [existingPath, newPath],
    })
    writeFileSync(existingPath, "// user overwrote during the session", "utf-8")
    writeFileSync(newPath, "// generated code", "utf-8")

    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "revert",
      notes: "User minta revert",
    })

    expect(result).toContain("ditarik")
    expect(readFileSync(existingPath, "utf-8")).toBe("export const todos: string[] = []")
    expect(existsSync(newPath)).toBe(false)

    const claim = loadClaims()
    expect(claim?.status).toBe("reverted")

    const timeline = loadTimeline(tmpDir, projectName)
    expect(timeline?.milestones[0].sprints[0].epics[0].tasks[0].status).toBe("todo")
    expect(timeline?.milestones[0].sprints[0].epics[0].tasks[0].notes).toContain("minta revert")
  })

  it("rejects when no open claim exists", () => {
    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "pass",
    })
    expect(result).toContain("Tidak ada claim")
  })

  it("rejects a verdict that does not match the open claim item", () => {
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [join(tmpDir, "add.ts")],
    })
    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Task lain",
      verdict: "pass",
    })
    expect(result).toContain("bukan")
  })

  it("partial-pass-continue — keeps code, keeps claim open, timeline stays in-progress", () => {
    const target = writeTargetFile("lib/add.ts", "")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })
    writeFileSync(target, "export function add() {}", "utf-8")

    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "partial-pass-continue",
      qa: [
        { question: "q1", answer: "karena output berubah", score: "partial" },
        { question: "q2", answer: "tidak tahu", score: "incorrect" },
      ],
    })

    expect(result).toContain("SEBAGIAN")
    expect(result).toContain("claim tetap terbuka")
    expect(readFileSync(target, "utf-8")).toContain("export function add")

    const claim = loadClaims()
    expect(claim?.status).toBe("open")
    expect(claim?.attempts).toBe(1)
    expect(claim?.qaHistory).toHaveLength(2)

    const timeline = loadTimeline(tmpDir, projectName)
    expect(timeline?.milestones[0].sprints[0].epics[0].tasks[0].status).toBe("in-progress")
  })

  it("records qa evidence and computes aggregate confidence on pass", () => {
    const target = writeTargetFile("lib/add.ts", "")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })

    const qa = [
      { question: "q1", answer: "karena error akan muncul", score: "correct" as const },
      { question: "q2", answer: "maka hasilnya berubah", score: "correct" as const },
    ]
    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "pass",
      level: "mid",
      qa,
    })

    expect(result).toContain("confidence 100/100")
    const claim = loadClaims()
    expect(claim?.confidence).toBe(100)
    expect(claim?.qaHistory).toHaveLength(2)
  })

  it("pass with low confidence warns Coach to keep watching", () => {
    const target = writeTargetFile("lib/add.ts", "")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })

    const result = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "pass",
      qa: [
        { question: "q1", answer: "iya paham", score: "partial" as const },
        { question: "q2", answer: "iya paham", score: "partial" as const },
      ],
    })

    expect(result).toContain("confidence 50/100")
    expect(result).toContain("memantau")
  })

  it("keeps claim open across a fail then closes it on a final pass", () => {
    const target = writeTargetFile("lib/add.ts", "")
    openClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      files: [target],
    })
    submitClaim({ projectDir: tmpDir, projectName, itemName: "Buat fungsi add", verdict: "fail" })
    expect(loadClaims()?.attempts).toBe(1)
    expect(loadClaims()?.status).toBe("open")

    const final = submitClaim({
      projectDir: tmpDir,
      projectName,
      itemName: "Buat fungsi add",
      verdict: "pass",
      qa: [
        { question: "q1", answer: "karena error handling", score: "correct" as const },
        { question: "q2", answer: "maka saya tambah fallback", score: "correct" as const },
      ],
    })
    expect(final).toContain("di-claim")
    expect(loadClaims()?.status).toBe("claimed")
  })
})

describe("updateEngineeringFromClaim", () => {
  it("clamps scores at 100", () => {
    const engineeringPath = join(tmpDir, ".codingschool", "engineering.json")
    writeFileSync(
      engineeringPath,
      JSON.stringify({ codeQuality: 99, architectureThinking: 0, gitProcess: 0, testingMindset: 0, documentation: 90, collaboration: 99, grcAwareness: 0, riskAssessment: 0 }),
      "utf-8",
    )
    updateEngineeringFromClaim(tmpDir, "senior")
    const engineering = JSON.parse(readFileSync(engineeringPath, "utf-8"))
    expect(engineering.collaboration).toBe(100)
    expect(engineering.codeQuality).toBe(100)
    expect(engineering.documentation).toBe(93)
  })
})
