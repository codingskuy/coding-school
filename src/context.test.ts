import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  defaultContext,
  loadContext,
  announceDiagnosis,
  announceReviewFindings,
  announceClaimResult,
  announceCapstone,
  announceProjectComplete,
  getTeachingSignals,
  getCoachBriefing,
} from "./context"
import { saveEngineering } from "./competency"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "context-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("context lifecycle", () => {
  it("defaults to an idle context", () => {
    const ctx = loadContext(tmpDir)
    expect(ctx.currentPhase).toBe("idle")
    expect(ctx.coach.weakDimensions).toHaveLength(0)
  })

  it("saves and reloads the context", () => {
    announceDiagnosis(tmpDir, { topic: "React", misconceptions: ["hooks re-run" ] })
    const ctx = loadContext(tmpDir)
    expect(ctx.currentPhase).toBe("teach")
    expect(ctx.teacher.misconceptions).toContain("hooks re-run")
    expect(ctx.teacher.activeTopic).toBe("React")
  })
})

describe("announceReviewFindings", () => {
  it("extracts skill gaps from improvements and grc flags", () => {
    announceReviewFindings(tmpDir, {
      improvements: ["use try/catch around the request", "add types"],
      grcFlags: ["missing input validation"],
    })
    const ctx = loadContext(tmpDir)
    expect(ctx.coach.skillGaps).toContain("error handling")
    expect(ctx.coach.skillGaps).toContain("type safety")
    expect(ctx.coach.skillGaps).toContain("input validation")
    expect(ctx.currentPhase).toBe("review")
  })
})

describe("announceClaimResult", () => {
  it("records the claimed level as readiness", () => {
    announceClaimResult(tmpDir, "mid")
    const ctx = loadContext(tmpDir)
    expect(ctx.coach.lastClaimLevel).toBe("mid")
    expect(ctx.coach.readiness).toBe("mid")
  })
})

describe("getTeachingSignals", () => {
  it("surfaces weak engineering dimensions below 50", () => {
    saveEngineering(tmpDir, {
      codeQuality: 90, architectureThinking: 10, gitProcess: 90, testingMindset: 80,
      documentation: 20, collaboration: 90, grcAwareness: 90, riskAssessment: 90,
    })
    announceReviewFindings(tmpDir, { improvements: [], grcFlags: [] })
    const signals = getTeachingSignals(tmpDir)
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.join(" ")).toContain("architecture thinking")
    expect(signals.join(" ")).toContain("documentation")
  })

  it("includes readiness and misconceptions when present", () => {
    announceDiagnosis(tmpDir, { topic: "React", misconceptions: ["closure" ] })
    announceClaimResult(tmpDir, "junior")
    const signals = getTeachingSignals(tmpDir)
    const joined = signals.join(" ")
    expect(joined).toContain("junior")
    expect(joined).toContain("closure")
  })
})

describe("getCoachBriefing", () => {
  it("tells Coach what Teacher found", () => {
    announceDiagnosis(tmpDir, { topic: "TypeScript", misconceptions: ["generics" ] })
    const briefing = getCoachBriefing(tmpDir)
    expect(briefing.join(" ")).toContain("TypeScript")
    expect(briefing.join(" ")).toContain("generics")
  })

  it("is empty when Teacher has shared nothing", () => {
    expect(getCoachBriefing(tmpDir)).toHaveLength(0)
  })
})

describe("announceCapstone", () => {
  it("stores the pending capstone and flips phase to project", () => {
    announceCapstone(tmpDir, { topic: "Rust", items: ["CLI Tool"], ready: true })
    const ctx = loadContext(tmpDir)
    expect(ctx.currentPhase).toBe("project")
    expect(ctx.coach.pendingCapstone?.topic).toBe("Rust")
    expect(ctx.coach.pendingCapstone?.items).toEqual(["CLI Tool"])
    expect(ctx.coach.pendingCapstone?.ready).toBe(true)
    expect(ctx.coach.pendingCapstone?.type).toBe("capstone")
  })

  it("surfaces the capstone in the Coach briefing", () => {
    announceCapstone(tmpDir, { topic: "Rust", items: ["CLI Tool", "Tests"], ready: true })
    const briefing = getCoachBriefing(tmpDir)
    const joined = briefing.join(" ")
    expect(joined).toContain("CAPSTONE PROJECT READY")
    expect(joined).toContain("CLI Tool")
    expect(joined).toContain("Tests")
  })

  it("stores a phase project with type='phase'", () => {
    announceCapstone(tmpDir, {
      topic: "Android",
      items: ["Proyek 1: Kalkulator Tip 🚀"],
      ready: true,
      type: "phase",
      projectName: "Kalkulator Tip",
      phaseLabel: "Tahap 1",
    })
    const ctx = loadContext(tmpDir)
    expect(ctx.coach.pendingCapstone?.type).toBe("phase")
    expect(ctx.coach.pendingCapstone?.projectName).toBe("Kalkulator Tip")
    expect(ctx.coach.pendingCapstone?.phaseLabel).toBe("Tahap 1")
  })

  it("surfaces a phase project in the Coach briefing", () => {
    announceCapstone(tmpDir, {
      topic: "Android",
      items: ["Proyek 1: Kalkulator Tip 🚀"],
      ready: true,
      type: "phase",
      projectName: "Kalkulator Tip",
      phaseLabel: "Tahap 1",
    })
    const briefing = getCoachBriefing(tmpDir)
    const joined = briefing.join(" ")
    expect(joined).toContain("PHASE PROJECT READY")
    expect(joined).toContain("Tahap 1")
    expect(joined).toContain("Kalkulator Tip")
  })
})

describe("announceProjectComplete", () => {
  it("records the finished project and flips phase to done", () => {
    announceProjectComplete(tmpDir, { projectName: "Todo App", topic: "Rust", summary: "Built a CLI tool with tests." })
    const ctx = loadContext(tmpDir)
    expect(ctx.currentPhase).toBe("done")
    expect(ctx.coach.completedProject?.projectName).toBe("Todo App")
    expect(ctx.coach.completedProject?.summary).toBe("Built a CLI tool with tests.")
  })

  it("surfaces the completed project to the Teacher", () => {
    announceProjectComplete(tmpDir, { projectName: "Todo App", topic: "Rust", summary: "shipped the CRUD" })
    const signals = getTeachingSignals(tmpDir)
    const joined = signals.join(" ")
    expect(joined).toContain("Todo App")
    expect(joined).toContain("Mark the project items done")
    expect(joined).toContain("shipped the CRUD")
  })

  it("clears pendingCapstone after project completion", () => {
    announceCapstone(tmpDir, { topic: "Rust", items: ["CLI Tool"], ready: true, type: "phase" })
    expect(loadContext(tmpDir).coach.pendingCapstone).toBeDefined()
    announceProjectComplete(tmpDir, { projectName: "CLI Tool", summary: "done" })
    expect(loadContext(tmpDir).coach.pendingCapstone).toBeUndefined()
  })
})

describe("defaultContext", () => {
  it("produces a fresh, valid context", () => {
    const ctx = defaultContext()
    expect(ctx.currentPhase).toBe("idle")
    expect(ctx.teacher.successfulHintLevel).toBe(1)
    expect(Array.isArray(ctx.coach.skillGaps)).toBe(true)
  })
})
