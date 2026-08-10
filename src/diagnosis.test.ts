import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { diagnoseStudent, generateDiagnosisQuestions, buildInitialDiagnosisPrompt } from "./diagnosis"
import { existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"

const TEST_DIR = join(import.meta.dir, "..", ".test-diagnosis")

beforeEach(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  process.env.HOME = TEST_DIR
  const modelDir = join(TEST_DIR, ".config", "opencode", "codingschool")
  if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe("diagnoseStudent", () => {
  test("returns result with isNew flag", () => {
    const result = diagnoseStudent("JavaScript")
    expect(typeof result.isNew).toBe("boolean")
    expect(result.level).toBeDefined()
  })

  test("returns greeting for new student", () => {
    const result = diagnoseStudent("React")
    expect(result.greeting).toContain("Welcome")
    expect(result.greeting).toContain("React")
  })

  test("returns nextStep based on knowledge", () => {
    const result = diagnoseStudent("Python")
    expect(["diagnose", "teach-fundamentals"]).toContain(result.nextStep)
  })

  test("applies name response", () => {
    const result = diagnoseStudent("Go", { name: "Alice" })
    expect(result.model.name).toBe("Alice")
  })

  test("applies goal response", () => {
    const result = diagnoseStudent("Go", { goal: "get a backend job" })
    expect(result.model.learningGoal).toBe("get a backend job")
  })

  test("applies self-assessment response", () => {
    const result = diagnoseStudent("Go", { selfAssessment: "zero — never touched it" })
    expect(result.model.confidence).toBeLessThan(30)
  })

  test("applies level response", () => {
    const result = diagnoseStudent("Go", { level: "intermediate" })
    expect(result.model.currentLevel).toBe("intermediate")
  })

  test("applies known concepts", () => {
    const result = diagnoseStudent("Go", { knownConcepts: "variables, loops" })
    expect(result.model.knowledge["variables"]).toBeDefined()
    expect(result.model.knowledge["loops"]).toBeDefined()
  })

  test("detects misconceptions from prior experience", () => {
    const result = diagnoseStudent("Go", {
      priorExperience: "I think all concepts are the same, no need to distinguish",
    })
    expect(result.model.misconceptions.length).toBeGreaterThan(0)
  })
})

describe("normalizeLevel", () => {
  test("maps English level terms", () => {
    const r1 = diagnoseStudent("X", { level: "beginner" })
    expect(r1.model.currentLevel).toBe("beginner")

    const r2 = diagnoseStudent("X", { level: "basic" })
    expect(r2.model.currentLevel).toBe("foundation")

    const r3 = diagnoseStudent("X", { level: "advanced" })
    expect(r3.model.currentLevel).toBe("advanced")
  })

  test("handles English terms", () => {
    const r1 = diagnoseStudent("X", { level: "expert" })
    expect(r1.model.currentLevel).toBe("expert")
  })
})

describe("generateDiagnosisQuestions", () => {
  test("returns array of questions", () => {
    const questions = generateDiagnosisQuestions("TypeScript")
    expect(questions.length).toBe(2)
    expect(questions[0].header).toBe("Self Assessment")
    expect(questions[1].header).toBe("Learning Goal")
  })

  test("each question has options", () => {
    const questions = generateDiagnosisQuestions("Rust")
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThan(0)
    }
  })
})

describe("buildInitialDiagnosisPrompt", () => {
  test("includes topic name", () => {
    const prompt = buildInitialDiagnosisPrompt("Django")
    expect(prompt).toContain("Django")
  })

  test("mentions cs_diagnose_student", () => {
    const prompt = buildInitialDiagnosisPrompt("Flask")
    expect(prompt).toContain("cs_diagnose_student")
  })
})
