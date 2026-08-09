import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, copyFileSync } from "fs"
import { join } from "path"
import { tmpdir, homedir } from "os"
import { saveStudentModel, loadStudentModel } from "./student-model"
import { writeJson } from "./utils/fs"
import { claimsDir, claimPath } from "./utils/paths"
import {
  topicSuccessStats,
  scaffoldingOffset,
  applyScaffoldingOffset,
  hasPoorClaimHistory,
  adjustedReexplainLevel,
} from "./meta"
import type { StudentModel } from "./utils/types"

const GLOBAL_MODEL = join(homedir(), ".config", "opencode", "codingschool", "student-model.json")
let backup: string | null = null

let tmpDir: string

function makeModel(overrides: Partial<StudentModel> = {}): StudentModel {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: "2026-01-01T00:00:00.000Z",
    currentLevel: "beginner",
    confidence: 50,
    learningGoal: "",
    preferredStyle: "concept-first",
    knowledge: {},
    patterns: {
      avgSessionLength: 0,
      preferredTimeOfDay: "unknown",
      helpSeekingBehavior: "asks-often",
      frustrationSignals: 0,
      curiositySignals: 0,
    },
    sessions: [],
    misconceptions: [],
    strengths: [],
    weakAreas: [],
    frequentStruggles: [],
    learningVelocity: "steady",
    ...overrides,
  }
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "meta-test-"))
  if (existsSync(GLOBAL_MODEL)) {
    backup = `${GLOBAL_MODEL}.meta-test-bak`
    copyFileSync(GLOBAL_MODEL, backup)
  } else {
    backup = null
  }
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  if (backup) {
    copyFileSync(backup, GLOBAL_MODEL)
    rmSync(backup, { force: true })
  } else {
    rmSync(GLOBAL_MODEL, { force: true })
  }
})

describe("topicSuccessStats", () => {
  it("returns neutral stats when the topic is unknown", () => {
    const stats = topicSuccessStats(tmpDir, "Ghost Topic")
    expect(stats.successRate).toBe(50)
    expect(stats.practiceCount).toBe(0)
  })

  it("computes success rate from knowledge and misconceptions", () => {
    saveStudentModel(
      makeModel({
        knowledge: {
          React: {
            topic: "React",
            level: "beginner",
            confidence: 40,
            lastAssessed: "2026-01-01T00:00:00.000Z",
            competency: { knowledge: 0, implementation: 0, debugging: 0, teaching: 0 },
            bloomStage: "understand",
            misconceptionNotes: [],
            practiceCount: 2,
            lastPracticed: "2026-01-01T00:00:00.000Z",
          },
        },
        misconceptions: [{ topic: "React", misconception: "hooks", resolved: false }],
      }),
    )
    const stats = topicSuccessStats(tmpDir, "React")
    // 40 + 2*5 - 10 = 40
    expect(stats.successRate).toBe(40)
    expect(stats.unresolvedMisconceptions).toBe(1)
    expect(stats.practiceCount).toBe(2)
  })
})

describe("scaffoldingOffset + applyScaffoldingOffset", () => {
  it("adds scaffolding for struggling topics, removes it for mastered ones", () => {
    saveStudentModel(
      makeModel({
        knowledge: {
          Hard: {
            topic: "Hard", level: "beginner", confidence: 20, lastAssessed: "2026-01-01",
            competency: { knowledge: 0, implementation: 0, debugging: 0, teaching: 0 },
            bloomStage: "remember", misconceptionNotes: [], practiceCount: 0, lastPracticed: "2026-01-01",
          },
          Easy: {
            topic: "Easy", level: "intermediate", confidence: 80, lastAssessed: "2026-01-01",
            competency: { knowledge: 0, implementation: 0, debugging: 0, teaching: 0 },
            bloomStage: "apply", misconceptionNotes: [], practiceCount: 4, lastPracticed: "2026-01-01",
          },
        },
      }),
    )
    expect(scaffoldingOffset(tmpDir, "Hard")).toBe(1)
    expect(scaffoldingOffset(tmpDir, "Easy")).toBe(-1)
    expect(scaffoldingOffset(tmpDir, "Unknown")).toBe(0)
  })

  it("clamps the final hint level to [1, 5]", () => {
    expect(applyScaffoldingOffset(5, 1)).toBe(5)
    expect(applyScaffoldingOffset(1, -1)).toBe(1)
    expect(applyScaffoldingOffset(3, 1)).toBe(4)
  })
})

describe("hasPoorClaimHistory", () => {
  it("is false when no claims exist", () => {
    expect(hasPoorClaimHistory(tmpDir, "Todo App")).toBe(false)
  })

  it("is true when a claim was reverted", () => {
    writeJson(claimPath(tmpDir, "Todo App"), {
      projectName: "Todo App",
      itemName: "Task X",
      status: "reverted",
      files: [],
      createdAt: "2026-01-01",
      attempts: 1,
    })
    expect(hasPoorClaimHistory(tmpDir, "Todo App")).toBe(true)
  })

  it("is true after repeated failed attempts (2+)", () => {
    writeJson(claimPath(tmpDir, "Todo App"), {
      projectName: "Todo App",
      itemName: "Task X",
      status: "open",
      files: [],
      createdAt: "2026-01-01",
      attempts: 2,
    })
    expect(hasPoorClaimHistory(tmpDir, "Todo App")).toBe(true)
  })

  it("ignores claims from other projects", () => {
    writeJson(claimPath(tmpDir, "Other App"), {
      projectName: "Other App",
      itemName: "Task X",
      status: "reverted",
      files: [],
      createdAt: "2026-01-01",
      attempts: 1,
    })
    expect(hasPoorClaimHistory(tmpDir, "Todo App")).toBe(false)
  })
})

describe("adjustedReexplainLevel", () => {
  it("keeps the level when history is healthy", () => {
    expect(adjustedReexplainLevel(tmpDir, "Todo App", "senior")).toBe("senior")
  })

  it("caps senior explanations to mid when history is poor", () => {
    writeJson(claimPath(tmpDir, "Todo App"), {
      projectName: "Todo App",
      itemName: "Task X",
      status: "open",
      files: [],
      createdAt: "2026-01-01",
      attempts: 2,
    })
    expect(adjustedReexplainLevel(tmpDir, "Todo App", "senior")).toBe("mid")
    expect(adjustedReexplainLevel(tmpDir, "Todo App", "junior")).toBe("junior")
  })
})
