import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import {
  generateReflectionPrompt,
  extractInsights,
  detectMisconceptionsFromReflection,
  processSessionReflection,
} from "./reflection"
import type { StudentModel } from "./utils/types"
import { existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"

const TEST_DIR = join(import.meta.dir, "..", ".test-reflection")

beforeEach(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  process.env.HOME = TEST_DIR
  const modelDir = join(TEST_DIR, ".config", "opencode", "codingschool")
  if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

function makeModel(): StudentModel {
  return {
    name: "Test Student",
    currentLevel: "beginner",
    learningGoal: "learn TypeScript",
    confidence: 50,
    knowledge: {
      TypeScript: {
        confidence: 50,
        level: "beginner",
        bloomStage: "understand",
        practiceCount: 2,
        lastPracticed: new Date().toISOString(),
        competency: { knowledge: 50, implementation: 40, debugging: 30, teaching: 20 },
      },
    },
    misconceptions: [],
    sessionSummaries: [],
    preferredStyle: "concept-first",
    weakAreas: [],
    strengths: [],
    patterns: { frustrationSignals: 0, curiositySignals: 1, sessionCount: 3, avgSessionLength: 25 },
  }
}

describe("generateReflectionPrompt", () => {
  test("end-of-session includes wrap-up text", () => {
    const prompt = generateReflectionPrompt("end-of-session", "React")
    expect(prompt.type).toBe("end-of-session")
    expect(prompt.prompt).toContain("wrap up")
    expect(prompt.prompt).toContain("React")
  })

  test("after-challenge includes bloom-specific question", () => {
    const prompt = generateReflectionPrompt("after-challenge", "Python", "apply")
    expect(prompt.type).toBe("after-challenge")
    expect(prompt.prompt).toContain("different project")
  })

  test("misconception-check includes misconception patterns", () => {
    const prompt = generateReflectionPrompt("misconception-check", "JavaScript")
    expect(prompt.type).toBe("misconception-check")
    expect(prompt.prompt).toContain("misconception")
  })

  test("progress-review includes progress dashboard", () => {
    const prompt = generateReflectionPrompt("progress-review", "Go")
    expect(prompt.type).toBe("progress-review")
    expect(prompt.prompt).toContain("progress")
  })
})

describe("extractInsights", () => {
  test("detects confusion", () => {
    const insights = extractInsights("I don't understand closures")
    expect(insights.some(i => i.includes("confusion"))).toBe(true)
  })

  test("detects understanding", () => {
    const insights = extractInsights("I got it, this makes sense now")
    expect(insights.some(i => i.includes("understanding"))).toBe(true)
  })

  test("detects desire to practice", () => {
    const insights = extractInsights("I want to practice more with code")
    expect(insights.some(i => i.includes("practice"))).toBe(true)
  })

  test("detects seeking deeper understanding", () => {
    const insights = extractInsights("Why does this work? I need to understand the reason")
    expect(insights.some(i => i.includes("deeper"))).toBe(true)
  })

  test("returns empty for neutral text", () => {
    const insights = extractInsights("The weather is nice today")
    expect(insights.length).toBe(0)
  })
})

describe("detectMisconceptionsFromReflection", () => {
  test("detects 'all concepts are same' misconception", () => {
    const mcs = detectMisconceptionsFromReflection("JS", "Semua konsep itu sama aja sih")
    expect(mcs.some(m => m.description.includes("Cannot distinguish"))).toBe(true)
  })

  test("detects dismissive misconception", () => {
    const mcs = detectMisconceptionsFromReflection("React", "Theory is not important, just skip to code")
    expect(mcs.some(m => m.description.includes("Dismisses"))).toBe(true)
  })

  test("detects overconfidence", () => {
    const mcs = detectMisconceptionsFromReflection("Go", "I'm always right, never wrong about this")
    expect(mcs.some(m => m.description.includes("Overconfident"))).toBe(true)
  })

  test("returns empty for clean reflection", () => {
    const mcs = detectMisconceptionsFromReflection("Python", "I learned about loops today")
    expect(mcs.length).toBe(0)
  })
})

describe("processSessionReflection", () => {
  test("returns summary with topic", () => {
    const model = makeModel()
    const result = processSessionReflection(
      "TypeScript",
      "I understood generics but still confused about utility types",
      model,
    )
    expect(result.summary).toContain("TypeScript")
  })

  test("adds misconceptions to model", () => {
    const model = makeModel()
    processSessionReflection(
      "React",
      "I think all React concepts are the same, no difference between them",
      model,
    )
    expect(model.misconceptions.length).toBeGreaterThan(0)
  })

  test("does not duplicate existing misconceptions", () => {
    const model = makeModel()
    model.misconceptions.push({
      topic: "React",
      description: "Cannot distinguish between related concepts",
      detectedAt: new Date().toISOString(),
      resolved: false,
    })
    processSessionReflection(
      "React",
      "All React concepts are the same",
      model,
    )
    const dupes = model.misconceptions.filter(
      m => m.description === "Cannot distinguish between related concepts",
    )
    expect(dupes.length).toBe(1)
  })

  test("generates next session plan", () => {
    const model = makeModel()
    const result = processSessionReflection(
      "TypeScript",
      "I don't understand generics at all, very confused",
      model,
    )
    expect(result.nextSessionPlan).toContain("Next session plan")
  })

  test("includes encouragement", () => {
    const model = makeModel()
    const result = processSessionReflection(
      "Docker",
      "I want to practice more with real projects",
      model,
    )
    expect(result.encouragement.length).toBeGreaterThan(0)
  })

  test("extracts insights from reflection text", () => {
    const model = makeModel()
    const result = processSessionReflection(
      "Go",
      "I understand goroutines but need more practice with channels",
      model,
    )
    expect(result.insights.length).toBeGreaterThan(0)
  })
})
