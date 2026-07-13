import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  createCoachContext,
  handleGreeting,
  handleLearnTopic,
  handlePrerequisiteQuestion,
  handleAchievement,
  handleResume,
  handleStatusCheck,
  processCoachingChoice,
} from "./coach"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("createCoachContext", () => {
  it("stores projectDir", () => {
    const ctx = createCoachContext(tmpDir)
    expect(ctx.projectDir).toBe(tmpDir)
  })
})

describe("handleGreeting", () => {
  it("returns empty message when no profile exists", () => {
    const ctx = createCoachContext(tmpDir)
    const res = handleGreeting(ctx)
    expect(res.message).toBe("")
    expect(res.intent).toBe("greeting")
  })

  it("welcomes back when profile and session exist", () => {
    mkdirSync(join(tmpDir, ".codingschool", "sessions"), { recursive: true })
    writeFileSync(join(tmpDir, ".codingschool", "profile.md"), "name: test")
    writeFileSync(join(tmpDir, ".codingschool", "sessions", "2026-07-13.md"), "# Session 2026-07-13")

    const ctx = createCoachContext(tmpDir)
    const res = handleGreeting(ctx)
    expect(res.message).toContain("Welcome back")
    expect(res.intent).toBe("greeting")
  })
})

describe("handleLearnTopic", () => {
  it("returns context estimation", () => {
    const res = handleLearnTopic("Rust")
    expect(res.message).toContain("Rust")
    expect(res.message).toContain("Beginner")
    expect(res.shouldPromptChoice).toBe(true)
    expect(res.intent).toBe("learn-topic")
  })
})

describe("handlePrerequisiteQuestion", () => {
  it("returns ready message when no prerequisite needed", () => {
    const res = handlePrerequisiteQuestion(tmpDir, "Rust")
    expect(res.message).toContain("Rust")
    expect(res.intent).toBe("question-prerequisite")
  })
})

describe("handleAchievement", () => {
  it("returns congratulatory message", () => {
    const res = handleAchievement("Rust")
    expect(res.message).toContain("Well done")
    expect(res.intent).toBe("achievement")
  })
})

describe("handleResume", () => {
  it("returns no-sessions message when no sessions exist", () => {
    const res = handleResume(tmpDir)
    expect(res.message).toContain("No previous sessions")
    expect(res.intent).toBe("resume")
  })
})

describe("handleStatusCheck", () => {
  it("returns status of no topics when none exist", () => {
    const res = handleStatusCheck(tmpDir)
    expect(res.message).toContain("haven't started")
    expect(res.intent).toBe("status-check")
  })
})

describe("processCoachingChoice", () => {
  it("choice A returns complete-task intent", () => {
    const res = processCoachingChoice("A")
    expect(res.intent).toBe("complete-task")
  })

  it("choice B returns learn-topic intent", () => {
    const res = processCoachingChoice("B")
    expect(res.intent).toBe("learn-topic")
  })
})
