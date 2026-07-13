import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { assessQuiz, renderAssessment, saveAssessment } from "./engine"
import type { AssessmentRubric } from "../utils/types"

describe("assessQuiz", () => {
  const deepAnswer = "Inheritance allows a class to reuse fields and methods from a parent class. It establishes an is-a relationship. For example, a Dog class can extend an Animal class to inherit its eat() method. The main advantage is code reuse, but it can lead to tight coupling. Composition is often preferred over inheritance because it is more flexible."

  const shallowAnswer = "Inheritance is when one class gets stuff from another class."

  it("returns a complete rubric with all 5 dimensions", () => {
    const rubric = assessQuiz({ answers: { q1: deepAnswer }, topic: "Inheritance", stage: "understand" })
    expect(rubric.theory).toBeGreaterThanOrEqual(0)
    expect(rubric.logic).toBeGreaterThanOrEqual(0)
    expect(rubric.coding).toBeGreaterThanOrEqual(0)
    expect(rubric.communication).toBeGreaterThanOrEqual(0)
    expect(rubric.bestPractice).toBeGreaterThanOrEqual(0)
    expect(rubric.total).toBeGreaterThanOrEqual(0)
  })

  it("scores shallow answers lower than deep answers", () => {
    const deep = assessQuiz({ answers: { q1: deepAnswer }, topic: "Inheritance", stage: "understand" })
    const shallow = assessQuiz({ answers: { q1: shallowAnswer }, topic: "Inheritance", stage: "understand" })
    expect(deep.total).toBeGreaterThan(shallow.total)
  })

  it("includes weakness and feedback", () => {
    const rubric = assessQuiz({ answers: { q1: shallowAnswer }, topic: "Inheritance", stage: "remember" })
    expect(rubric.weakness.length).toBeGreaterThan(0)
    expect(rubric.feedback.length).toBeGreaterThan(0)
  })

  it("handles multiple answers", () => {
    const rubric = assessQuiz({
      answers: { q1: "Inheritance is code reuse.", q2: "Better than composition." },
      topic: "Inheritance",
      stage: "evaluate",
    })
    expect(rubric.total).toBeGreaterThan(0)
  })
})

describe("renderAssessment", () => {
  it("includes all dimensions in output", () => {
    const rubric: AssessmentRubric = {
      theory: 85, logic: 70, coding: 90, communication: 80, bestPractice: 75,
      total: 80, weakness: "Not enough examples", feedback: "Good effort",
    }
    const out = renderAssessment(rubric)
    expect(out).toContain("Assessment")
    expect(out).toContain("Theory:")
    expect(out).toContain("Logic:")
    expect(out).toContain("Coding:")
    expect(out).toContain("Communication:")
    expect(out).toContain("Best Practice:")
    expect(out).toContain("80/100")
  })
})

describe("saveAssessment", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("saves assessment to reports directory", () => {
    const rubric = assessQuiz({ answers: { q1: "A good answer" }, topic: "Rust", stage: "understand" })
    const path = saveAssessment(tmpDir, "Rust", rubric)
    expect(existsSync(path)).toBe(true)
  })

  it("appends to existing assessments", () => {
    const rubric1 = assessQuiz({ answers: { q1: "First answer" }, topic: "Rust", stage: "remember" })
    saveAssessment(tmpDir, "Rust", rubric1)

    const rubric2 = assessQuiz({ answers: { q1: "Second answer" }, topic: "Rust", stage: "understand" })
    saveAssessment(tmpDir, "Rust", rubric2)
  })

  it("advances Bloom stage on pass (total >= 70)", () => {
    const progressPath = join(tmpDir, ".codingschool", "progress.json")
    mkdirSync(join(tmpDir, ".codingschool"), { recursive: true })
    writeFileSync(progressPath, JSON.stringify({
      topics: {
        Rust: { name: "Rust", percent: 50, theory: [], completedTheory: [], practice: [], completedPractice: [], quizzes: [], currentBloomStage: "remember" },
      },
      global: { softwareEngineering: 50, knowledge: 50, practice: 50, architecture: 25 },
      xp: 100,
      level: 1,
    }))

    saveAssessment(tmpDir, "Rust", {
      theory: 85, logic: 70, coding: 90, communication: 80, bestPractice: 75,
      total: 80, weakness: "", feedback: "",
    })

    const saved = JSON.parse(require("fs").readFileSync(progressPath, "utf-8"))
    expect(saved.topics.Rust.currentBloomStage).toBe("understand")
    expect(saved.xp).toBe(200)
  })
})
