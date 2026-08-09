import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { loadWorkflow, recordTool, checkAdvisories, hasRoadmap } from "./workflow"
import { workflowPath } from "./utils/paths"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "workflow-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("recordTool", () => {
  it("tracks teacher topic activity", () => {
    recordTool(tmpDir, { toolName: "cs_diagnose_student", topic: "React" })
    recordTool(tmpDir, { toolName: "cs_teach_concept", topic: "React" })
    recordTool(tmpDir, { toolName: "cs_assess_quiz", topic: "React" })

    const state = loadWorkflow(tmpDir)
    expect(state.teacher.diagnosedTopics).toContain("React")
    expect(state.teacher.taughtTopics).toContain("React")
    expect(state.teacher.assessedTopics).toContain("React")
  })

  it("does not duplicate topics", () => {
    recordTool(tmpDir, { toolName: "cs_diagnose_student", topic: "React" })
    recordTool(tmpDir, { toolName: "cs_diagnose_student", topic: "React" })
    expect(loadWorkflow(tmpDir).teacher.diagnosedTopics).toHaveLength(1)
  })

  it("marks timeline init and keeps partial claims open", () => {
    recordTool(tmpDir, { toolName: "cs_timeline_init" })
    recordTool(tmpDir, { toolName: "cs_claim_open", item: "Buat fungsi add" })
    recordTool(tmpDir, { toolName: "cs_claim_submit", item: "Buat fungsi add", verdict: "partial-pass-continue" })

    const state = loadWorkflow(tmpDir)
    expect(state.coach.timelineInit).toBe(true)
    expect(state.coach.claimItems["Buat fungsi add"]).toBe("open")

    recordTool(tmpDir, { toolName: "cs_claim_submit", item: "Buat fungsi add", verdict: "pass" })
    expect(loadWorkflow(tmpDir).coach.claimItems["Buat fungsi add"]).toBe("closed")
  })
})

describe("checkAdvisories", () => {
  it("warns when teaching an undiagnosed topic", () => {
    const warnings = checkAdvisories(tmpDir, { toolName: "cs_teach_concept", topic: "React" })
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain("diagnosed")
  })

  it("stays silent when the topic was diagnosed", () => {
    recordTool(tmpDir, { toolName: "cs_diagnose_student", topic: "React" })
    const warnings = checkAdvisories(tmpDir, { toolName: "cs_teach_concept", topic: "React" })
    expect(warnings).toHaveLength(0)
  })

  it("warns when competency is updated before teaching", () => {
    const warnings = checkAdvisories(tmpDir, { toolName: "cs_update_competency", topic: "React" })
    expect(warnings.length).toBeGreaterThan(0)
  })

  it("warns when submitting a claim with no recorded open claim", () => {
    const warnings = checkAdvisories(tmpDir, { toolName: "cs_claim_submit", item: "Task X" })
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain("no open claim")
  })

  it("never throws for unknown tools", () => {
    expect(checkAdvisories(tmpDir, { toolName: "cs_unknown" })).toHaveLength(0)
  })
})

describe("hasRoadmap", () => {
  it("is false by default, true after a roadmap or diagnosis", () => {
    expect(hasRoadmap(tmpDir, "React")).toBe(false)
    recordTool(tmpDir, { toolName: "cs_create_roadmap", topic: "React" })
    expect(hasRoadmap(tmpDir, "React")).toBe(true)
  })
})

describe("persistence", () => {
  it("writes workflow.json to .codingschool", () => {
    recordTool(tmpDir, { toolName: "cs_timeline_init" })
    expect(existsSync(workflowPath(tmpDir))).toBe(true)
    expect(readFileSync(workflowPath(tmpDir), "utf-8")).toContain("timelineInit")
  })
})
