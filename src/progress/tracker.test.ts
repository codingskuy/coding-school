import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { getProgress, updateProgress, computeCurrentItem, renderProgressBar, renderDashboard } from "./tracker"
import type { ProgressData } from "../utils/types"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("getProgress", () => {
  it("returns default when no progress file exists", () => {
    const p = getProgress(tmpDir)
    expect(p.topics).toEqual({})
    expect(p.xp).toBe(0)
    expect(p.level).toBe(1)
  })
})

describe("updateProgress", () => {
  it("creates topic entry on first update", () => {
    const p = updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Variables", status: "done" })
    expect(p.topics["Rust"]).toBeDefined()
    expect(p.topics["Rust"].name).toBe("Rust")
  })

  it("awards XP when status is done", () => {
    const p = updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Variables", status: "done" })
    expect(p.xp).toBe(50)
  })

  it("does not award XP for non-done status", () => {
    const p1 = updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Variables", status: "done" })
    expect(p1.xp).toBe(50)
    const p2 = updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Data Types", status: "skipped" })
    expect(p2.xp).toBe(50)
  })

  it("persists between calls", () => {
    updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Variables", status: "done" })
    const p = getProgress(tmpDir)
    expect(p.xp).toBe(50)
  })
})

describe("currentItem / lastCompletedItem", () => {
  function seed(): void {
    updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Variables", status: "done" })
    updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Data Types", status: "done" })
  }

  it("tracks the last completed item", () => {
    seed()
    const p = getProgress(tmpDir)
    expect(p.topics.Rust.lastCompletedItem).toBe("Data Types")
  })

  it("lastCompletedItem only set when status is done", () => {
    updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Variables", status: "in-progress" })
    expect(getProgress(tmpDir).topics.Rust.lastCompletedItem).toBeNull()
  })

  it("computeCurrentItem returns first unfinished item", () => {
    seed()
    const p = getProgress(tmpDir)
    expect(computeCurrentItem(p.topics.Rust)).toBeNull()
  })

  it("computeCurrentItem skips completed items", () => {
    updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Theory A", status: "done" })
    updateProgress({ projectDir: tmpDir, topic: "Rust", item: "Practice Z", status: "done" })
    const p = getProgress(tmpDir)
    const tp = p.topics.Rust
    tp.theory = ["Theory A", "Theory B"]
    tp.practice = ["Practice Z"]
    tp.currentItem = computeCurrentItem(tp)
    expect(tp.currentItem).toBe("Theory B")
  })
})

describe("renderProgressBar", () => {
  it("renders 0% as empty bar", () => {
    expect(renderProgressBar(0)).toBe("░".repeat(10))
  })

  it("renders 100% as full bar", () => {
    expect(renderProgressBar(100)).toBe("█".repeat(10))
  })

  it("renders 50% as half bar", () => {
    expect(renderProgressBar(50)).toBe("█".repeat(5) + "░".repeat(5))
  })
})

describe("renderDashboard", () => {
  it("returns a string", () => {
    const progress: ProgressData = {
      topics: {},
      global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 },
      xp: 0,
      level: 1,
    }
    const dash = renderDashboard(progress)
    expect(typeof dash).toBe("string")
    expect(dash.length).toBeGreaterThan(0)
  })

  it("shows XP and Level", () => {
    const progress: ProgressData = {
      topics: { Rust: { name: "Rust", percent: 50, theory: [], completedTheory: [], practice: [], completedPractice: [], quizzes: [], currentBloomStage: "understand" } },
      global: { softwareEngineering: 50, knowledge: 50, practice: 50, architecture: 25 },
      xp: 500,
      level: 1,
    }
    const dash = renderDashboard(progress)
    expect(dash).toContain("XP: 500")
    expect(dash).toContain("Level: 1")
  })
})
