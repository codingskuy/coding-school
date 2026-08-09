import { describe, it, expect } from "bun:test"
import {
  computeComprehensionConfidence,
  recommendVerdict,
  buildComprehensionQuestions,
  scoreAnswer,
  COMPREHENSION_THRESHOLDS,
} from "./comprehension"
import type { ComprehensionAnswer } from "./utils/types"

describe("computeComprehensionConfidence", () => {
  it("returns 0 for no answers", () => {
    expect(computeComprehensionConfidence([])).toBe(0)
  })

  it("weights the weakest answer to punish lucky guesses", () => {
    // avg = 50, min = 0 → 70% avg + 30% min = 35 (not 50)
    const qa: ComprehensionAnswer[] = [
      { question: "q1", answer: "a1", score: "correct" },
      { question: "q2", answer: "a2", score: "incorrect" },
    ]
    expect(computeComprehensionConfidence(qa)).toBe(35)
  })

  it("scores all-correct answers at 100", () => {
    const qa: ComprehensionAnswer[] = [
      { question: "q1", answer: "a1", score: "correct" },
      { question: "q2", answer: "a2", score: "correct" },
    ]
    expect(computeComprehensionConfidence(qa)).toBe(100)
  })

  it("rounds to a whole number", () => {
    const qa: ComprehensionAnswer[] = [
      { question: "q1", answer: "a1", score: "correct" },
      { question: "q2", answer: "a2", score: "partial" },
      { question: "q3", answer: "a3", score: "partial" },
    ]
    // avg = (100+50+50)/3 = 66.67, min = 50 → 61.67 → 62
    expect(computeComprehensionConfidence(qa)).toBe(62)
  })
})

describe("recommendVerdict", () => {
  it("passes at or above the pass threshold", () => {
    expect(recommendVerdict(COMPREHENSION_THRESHOLDS.pass)).toBe("pass")
    expect(recommendVerdict(100)).toBe("pass")
  })

  it("recommends partial-pass-continue in the middle band", () => {
    expect(recommendVerdict(COMPREHENSION_THRESHOLDS.partial)).toBe("partial-pass-continue")
    expect(recommendVerdict(74)).toBe("partial-pass-continue")
  })

  it("fails below the partial threshold", () => {
    expect(recommendVerdict(39)).toBe("fail")
    expect(recommendVerdict(0)).toBe("fail")
  })
})

describe("buildComprehensionQuestions", () => {
  it("returns level-appropriate questions", () => {
    expect(buildComprehensionQuestions("junior").length).toBeGreaterThan(0)
    expect(buildComprehensionQuestions("mid").length).toBeGreaterThan(0)
    expect(buildComprehensionQuestions("senior").length).toBeGreaterThan(0)
  })

  it("includes the first file name when provided", () => {
    const q = buildComprehensionQuestions("junior", ["/proj/lib/add.ts", "/proj/lib/todo.ts"])
    expect(q[0].question).toContain("add.ts")
  })
})

describe("scoreAnswer", () => {
  it("marks empty answers as incorrect", () => {
    expect(scoreAnswer("", "q")).toBe("incorrect")
    expect(scoreAnswer("   ", "q")).toBe("incorrect")
  })

  it("marks demonstration answers as correct", () => {
    expect(scoreAnswer("karena input yang salah, maka kodenya akan error", "q")).toBe("correct")
  })

  it("marks vague/parroted answers as partial or incorrect", () => {
    expect(scoreAnswer("iya saya paham", "q")).toBe("partial")
    expect(scoreAnswer("tidak tahu", "q")).toBe("incorrect")
  })
})
