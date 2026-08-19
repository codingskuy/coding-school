import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { initLearningEnv } from "./init-learning-env"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-init-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("initLearningEnv", () => {
  it("creates folder and .codingschool structure", () => {
    const result = initLearningEnv(tmpDir, "React", "react-fundamentals")
    expect(result.success).toBe(true)
    expect(result.folderPath).toBe(join(tmpDir, "react-fundamentals"))
    expect(existsSync(join(tmpDir, "react-fundamentals"))).toBe(true)
    expect(existsSync(join(tmpDir, "react-fundamentals", ".codingschool", "context.json"))).toBe(true)
    expect(existsSync(join(tmpDir, "react-fundamentals", ".codingschool", "progress.json"))).toBe(true)
  })

  it("initializes git", () => {
    const result = initLearningEnv(tmpDir, "React", "react-fundamentals")
    expect(result.gitInitialized).toBe(true)
    expect(existsSync(join(tmpDir, "react-fundamentals", ".git"))).toBe(true)
  })

  it("fails if folder already exists", () => {
    initLearningEnv(tmpDir, "React", "react-fundamentals")
    const result = initLearningEnv(tmpDir, "React", "react-fundamentals")
    expect(result.success).toBe(false)
    expect(result.message).toContain("already exists")
  })

  it("writes correct context.json", () => {
    initLearningEnv(tmpDir, "React", "react-fundamentals")
    const ctx = JSON.parse(readFileSync(join(tmpDir, "react-fundamentals", ".codingschool", "context.json"), "utf-8"))
    expect(ctx.currentPhase).toBe("learning")
    expect(ctx.topic).toBe("React")
    expect(ctx.folderName).toBe("react-fundamentals")
  })

  it("writes correct progress.json", () => {
    initLearningEnv(tmpDir, "React", "react-fundamentals")
    const prog = JSON.parse(readFileSync(join(tmpDir, "react-fundamentals", ".codingschool", "progress.json"), "utf-8"))
    expect(prog.topics).toEqual({})
    expect(prog.xp).toBe(0)
  })
})
