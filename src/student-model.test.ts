import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import {
  loadStudentModel,
  saveStudentModel,
  initStudentModel,
  updateKnowledge,
  addMisconception,
  resolveMisconception,
  updateConfidence,
  updateLevel,
  addSessionSummary,
  updateWeakAreas,
  updateStrengths,
  getRecommendedStyle,
  calculateConfidence,
  shouldPromoteLevel,
  shouldDemoteLevel,
  renderStudentModel,
  deriveStudentSignals,
} from "./student-model"
import type { StudentModel } from "./utils/types"

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "student-model-test-"))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function makeModel(overrides: Partial<StudentModel> = {}): StudentModel {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: "2026-01-01T00:00:00.000Z",
    currentLevel: "beginner",
    confidence: 50,
    learningGoal: "learn backend",
    preferredStyle: "concept-first",
    knowledge: {},
    patterns: {
      avgSessionLength: 30,
      preferredTimeOfDay: "evening",
      helpSeekingBehavior: "asks-often",
      frustrationSignals: 0,
      curiositySignals: 2,
    },
    sessions: [],
    misconceptions: [],
    strengths: [],
    weakAreas: [],
    ...overrides,
  }
}

describe("initStudentModel", () => {
  test("creates model with defaults", () => {
    const model = initStudentModel()
    expect(model.currentLevel).toBe("beginner")
    expect(model.confidence).toBe(0)
  })

  test("creates model with name and goal", () => {
    const model = initStudentModel("Rizky", "learn React")
    expect(model.name).toBe("Rizky")
    expect(model.learningGoal).toBe("learn React")
  })
})

describe("updateKnowledge", () => {
  test("creates knowledge node when topic is new", () => {
    const model = makeModel()
    const updated = updateKnowledge(model, "REST API", {
      confidence: 70,
      bloomStage: "apply",
    })
    expect(updated.knowledge["REST API"]).toBeDefined()
    expect(updated.knowledge["REST API"].confidence).toBe(70)
    expect(updated.knowledge["REST API"].bloomStage).toBe("apply")
  })

  test("updates existing knowledge node", () => {
    const model = makeModel()
    updateKnowledge(model, "REST API", { confidence: 30 })
    const updated = updateKnowledge(model, "REST API", { confidence: 80 })
    expect(updated.knowledge["REST API"].confidence).toBe(80)
  })
})

describe("misconception tracking", () => {
  test("adds misconception", () => {
    const model = makeModel()
    const updated = addMisconception(model, "REST", "Confuses HTTP methods")
    expect(updated.misconceptions.length).toBe(1)
    expect(updated.misconceptions[0].resolved).toBe(false)
  })

  test("resolves misconception", () => {
    const model = makeModel()
    addMisconception(model, "REST", "Confuses HTTP methods")
    const updated = resolveMisconception(model, "REST")
    expect(updated.misconceptions[0].resolved).toBe(true)
    expect(updated.misconceptions[0].resolvedAt).toBeDefined()
  })
})

describe("confidence & level", () => {
  test("updateConfidence clamps to 0-100", () => {
    const model = makeModel()
    const high = updateConfidence(model, 150)
    expect(high.confidence).toBe(100)
    const low = updateConfidence(model, -10)
    expect(low.confidence).toBe(0)
  })

  test("updateLevel changes level", () => {
    const model = makeModel()
    const updated = updateLevel(model, "intermediate")
    expect(updated.currentLevel).toBe("intermediate")
  })
})

describe("session summaries", () => {
  test("adds session summary", () => {
    const model = makeModel()
    const updated = addSessionSummary(model, {
      date: "2026-01-01",
      topic: "REST API",
      duration: 45,
      bloomStageReached: "apply",
      competencyDelta: { knowledge: 10 },
      reflectionNotes: ["Learned about HTTP methods"],
    })
    expect(updated.sessions.length).toBe(1)
    expect(updated.sessions[0].topic).toBe("REST API")
  })
})

describe("weak areas & strengths", () => {
  test("adds weak areas without duplicates", () => {
    const model = makeModel()
    const updated = updateWeakAreas(model, ["debugging", "testing"])
    expect(updated.weakAreas).toEqual(["debugging", "testing"])
    const deduped = updateWeakAreas(model, ["debugging", "refactoring"])
    expect(deduped.weakAreas).toEqual(["debugging", "testing", "refactoring"])
  })

  test("adds strengths without duplicates", () => {
    const model = makeModel()
    const updated = updateStrengths(model, ["clean code", "testing"])
    expect(updated.strengths).toEqual(["clean code", "testing"])
  })
})

describe("getRecommendedStyle", () => {
  test("returns example-first for low confidence", () => {
    const model = makeModel({ confidence: 10 })
    model.knowledge["A"] = { topic: "A", level: "beginner", confidence: 10, lastAssessed: "", competency: { knowledge: 10, implementation: 0, debugging: 0, teaching: 0 }, bloomStage: "remember", misconceptionNotes: [], practiceCount: 0, lastPracticed: "" }
    expect(getRecommendedStyle(model)).toBe("example-first")
  })

  test("returns concept-first for medium confidence", () => {
    const model = makeModel({ confidence: 50 })
    model.knowledge["A"] = { topic: "A", level: "beginner", confidence: 50, lastAssessed: "", competency: { knowledge: 50, implementation: 0, debugging: 0, teaching: 0 }, bloomStage: "remember", misconceptionNotes: [], practiceCount: 0, lastPracticed: "" }
    expect(getRecommendedStyle(model)).toBe("concept-first")
  })

  test("returns analogy-first when curiosity is high", () => {
    const model = makeModel({
      confidence: 70,
      patterns: { avgSessionLength: 30, preferredTimeOfDay: "evening", helpSeekingBehavior: "asks-often", frustrationSignals: 0, curiositySignals: 10 },
    })
    model.knowledge["A"] = { topic: "A", level: "beginner", confidence: 70, lastAssessed: "", competency: { knowledge: 70, implementation: 0, debugging: 0, teaching: 0 }, bloomStage: "remember", misconceptionNotes: [], practiceCount: 0, lastPracticed: "" }
    expect(getRecommendedStyle(model)).toBe("analogy-first")
  })
})

describe("calculateConfidence", () => {
  test("returns base confidence when no topics", () => {
    const model = makeModel({ confidence: 45 })
    expect(calculateConfidence(model)).toBe(45)
  })
})

describe("level promotion/demotion", () => {
  test("promotes when confidence >= 80 and competencies met", () => {
    const model = makeModel({ confidence: 85 })
    model.knowledge["A"] = {
      topic: "A", level: "beginner", confidence: 85, lastAssessed: "",
      competency: { knowledge: 70, implementation: 50, debugging: 0, teaching: 0 },
      bloomStage: "apply", misconceptionNotes: [], practiceCount: 3, lastPracticed: "",
    }
    expect(shouldPromoteLevel(model)).toBe(true)
  })

  test("does not promote when confidence is low", () => {
    const model = makeModel({ confidence: 50 })
    expect(shouldPromoteLevel(model)).toBe(false)
  })

  test("demotes when confidence < 40", () => {
    const model = makeModel({ confidence: 30 })
    expect(shouldDemoteLevel(model)).toBe(true)
  })

  test("does not demote when confidence is high", () => {
    const model = makeModel({ confidence: 80 })
    expect(shouldDemoteLevel(model)).toBe(false)
  })
})

describe("renderStudentModel", () => {
  test("renders basic info", () => {
    const model = makeModel({ name: "Rizky", currentLevel: "foundation" })
    const output = renderStudentModel(model)
    expect(output).toContain("Rizky")
    expect(output).toContain("foundation")
  })

  test("renders knowledge map", () => {
    const model = makeModel()
    model.knowledge["REST"] = {
      topic: "REST", level: "beginner", confidence: 80, lastAssessed: "",
      competency: { knowledge: 80, implementation: 60, debugging: 0, teaching: 0 },
      bloomStage: "apply", misconceptionNotes: [], practiceCount: 5, lastPracticed: "",
    }
    const output = renderStudentModel(model)
    expect(output).toContain("REST")
    expect(output).toContain("★")
  })

  test("renders misconceptions", () => {
    const model = makeModel()
    addMisconception(model, "REST", "Wrong method")
    const output = renderStudentModel(model)
    expect(output).toContain("Active Misconceptions")
    expect(output).toContain("Wrong method")
  })
})

describe("deriveStudentSignals", () => {
  test("derives frequent struggles from unresolved misconceptions and low-confidence topics", () => {
    const model = makeModel()
    addMisconception(model, "REST", "Wrong method")
    addMisconception(model, "SQL", "Join order")
    resolveMisconception(model, "SQL", "Join order")
    model.knowledge["Auth"] = {
      topic: "Auth", level: "beginner", confidence: 20, lastAssessed: "",
      competency: { knowledge: 0, implementation: 0, debugging: 0, teaching: 0 },
      bloomStage: "remember", misconceptionNotes: [], practiceCount: 0, lastPracticed: "",
    }
    deriveStudentSignals(model)
    expect(model.frequentStruggles).toContain("REST")
    expect(model.frequentStruggles).not.toContain("SQL")
    expect(model.frequentStruggles).toContain("Auth")
  })

  test("caps frequent struggles at five topics", () => {
    const model = makeModel()
    for (const t of ["A", "B", "C", "D", "E", "F", "G"]) {
      addMisconception(model, t, `mis on ${t}`)
    }
    deriveStudentSignals(model)
    expect(model.frequentStruggles.length).toBeLessThanOrEqual(5)
  })

  test("stays steady with fewer than three sessions", () => {
    const model = makeModel()
    deriveStudentSignals(model)
    expect(model.learningVelocity).toBe("steady")
  })

  test("reports fast velocity when later sessions reach higher Bloom stages", () => {
    const model = makeModel({
      sessions: [
        { date: "2026-01-01", topic: "React", bloomStageReached: "remember", durationMin: 30, quizScore: 40 },
        { date: "2026-01-02", topic: "React", bloomStageReached: "understand", durationMin: 30, quizScore: 50 },
        { date: "2026-01-03", topic: "React", bloomStageReached: "apply", durationMin: 30, quizScore: 60 },
        { date: "2026-01-04", topic: "React", bloomStageReached: "analyze", durationMin: 30, quizScore: 70 },
        { date: "2026-01-05", topic: "React", bloomStageReached: "evaluate", durationMin: 30, quizScore: 80 },
        { date: "2026-01-06", topic: "React", bloomStageReached: "create", durationMin: 30, quizScore: 90 },
      ],
    })
    deriveStudentSignals(model)
    expect(model.learningVelocity).toBe("fast")
  })
})
