import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { writeJson, ensureDir } from "./utils/fs"
import { progressPath } from "./utils/paths"
import type { ProgressData, StudentModel, CompetencyData, BloomStage } from "./utils/types"

const DEFAULT_GLOBAL_DIR = join(homedir(), ".config", "opencode", "codingschool")

function studentModelPath(globalDir: string): string {
  return join(globalDir, "student-model.json")
}

function competencyPath(projectDir: string): string {
  return join(projectDir, ".codingschool", "competency.json")
}

function migrationMarker(projectDir: string): string {
  return join(projectDir, ".codingschool", ".migrated-v2")
}

function progressLevelToLearningLevel(xp: number): "beginner" | "foundation" | "intermediate" | "advanced" | "expert" {
  if (xp < 500) return "beginner"
  if (xp < 1500) return "foundation"
  if (xp < 3000) return "intermediate"
  if (xp < 5000) return "advanced"
  return "expert"
}

function estimateCompetencyFromPercent(percent: number): { knowledge: number; implementation: number; debugging: number; teaching: number } {
  return {
    knowledge: Math.round(percent * 0.9),
    implementation: Math.round(percent * 0.7),
    debugging: Math.round(percent * 0.4),
    teaching: Math.round(percent * 0.2),
  }
}

export interface MigrationOptions {
  globalDir?: string
}

export function isMigrationNeeded(projectDir: string, opts?: MigrationOptions): boolean {
  const globalDir = opts?.globalDir ?? DEFAULT_GLOBAL_DIR
  const marker = migrationMarker(projectDir)
  if (existsSync(marker)) return false

  const progressFile = progressPath(projectDir)
  if (!existsSync(progressFile)) return false

  const modelPath = studentModelPath(globalDir)
  if (existsSync(modelPath)) {
    try {
      const existing = JSON.parse(readFileSync(modelPath, "utf-8")) as StudentModel
      if (Object.keys(existing.knowledge).length > 0) return false
    } catch { /* proceed with migration */ }
  }

  return true
}

export function migrate(projectDir: string, opts?: MigrationOptions): { migrated: boolean; topics: number; errors: string[] } {
  if (!isMigrationNeeded(projectDir, opts)) {
    return { migrated: false, topics: 0, errors: [] }
  }

  const globalDir = opts?.globalDir ?? DEFAULT_GLOBAL_DIR
  const errors: string[] = []
  let progress: ProgressData

  try {
    const raw = readFileSync(progressPath(projectDir), "utf-8")
    progress = JSON.parse(raw) as ProgressData
  } catch (e) {
    errors.push(`Failed to read progress.json: ${e}`)
    return { migrated: false, topics: 0, errors }
  }

  const topicCount = Object.keys(progress.topics).length
  if (topicCount === 0) {
    markMigrationDone(projectDir)
    return { migrated: true, topics: 0, errors: [] }
  }

  const model: StudentModel = {
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    currentLevel: progressLevelToLearningLevel(progress.xp),
    confidence: Math.min(80, Math.round(progress.xp / 50)),
    learningGoal: "",
    preferredStyle: "concept-first",
    knowledge: {},
    patterns: {
      avgSessionLength: 0,
      preferredTimeOfDay: "unknown",
      helpSeekingBehavior: "independent",
      frustrationSignals: 0,
      curiositySignals: 0,
    },
    sessions: [],
    misconceptions: [],
    strengths: [],
    weakAreas: [],
    frequentStruggles: [],
    learningVelocity: "steady",
  }

  const competencyData: CompetencyData = { topics: {} }

  for (const [topicName, topicProgress] of Object.entries(progress.topics)) {
    const percent = topicProgress.percent || 0
    const scores = estimateCompetencyFromPercent(percent)

    model.knowledge[topicName] = {
      topic: topicName,
      level: progressLevelToLearningLevel(progress.xp),
      confidence: percent,
      lastAssessed: new Date().toISOString(),
      competency: scores,
      bloomStage: (topicProgress.currentBloomStage || "remember") as BloomStage,
      misconceptionNotes: [],
      practiceCount: (topicProgress.completedPractice?.length ?? 0) + (topicProgress.completedTheory?.length ?? 0),
      lastPracticed: new Date().toISOString(),
    }

    if (percent < 40) {
      model.weakAreas.push(topicName)
    } else if (percent >= 70) {
      model.strengths.push(topicName)
    }

    competencyData.topics[topicName] = scores
  }

  try {
    ensureDir(globalDir)
    writeJson(studentModelPath(globalDir), model)
  } catch (e) {
    errors.push(`Failed to write student-model.json: ${e}`)
  }

  try {
    writeJson(competencyPath(projectDir), competencyData)
  } catch (e) {
    errors.push(`Failed to write competency.json: ${e}`)
  }

  markMigrationDone(projectDir)

  return { migrated: true, topics: topicCount, errors }
}

function markMigrationDone(projectDir: string): void {
  const marker = migrationMarker(projectDir)
  try {
    writeJson(marker, { migrated: true, date: new Date().toISOString() })
  } catch { /* best effort */ }
}

export function renderMigrationResult(result: ReturnType<typeof migrate>): string {
  if (!result.migrated) return "Migration not needed."
  const lines = [`Migrated ${result.topics} topic(s).`]
  if (result.errors.length > 0) {
    lines.push("Errors:")
    for (const e of result.errors) lines.push(`  - ${e}`)
  }
  return lines.join("\n")
}
