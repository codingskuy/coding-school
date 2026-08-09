import { readJson, writeJson, ensureDir } from "./utils/fs"
import { homedir } from "os"
import { join } from "path"
import type {
  StudentModel,
  KnowledgeNode,
  CompetencyScores,
  LearningLevel,
  ExplanationStyle,
  Misconception,
  SessionSummary,
  BloomStage,
  LearningVelocity,
} from "./utils/types"

const GLOBAL_DIR = join(homedir(), ".config", "opencode", "codingschool")
const STUDENT_MODEL_PATH = join(GLOBAL_DIR, "student-model.json")

function defaultCompetency(): CompetencyScores {
  return { knowledge: 0, implementation: 0, debugging: 0, teaching: 0 }
}

function defaultStudentModel(): StudentModel {
  return {
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    currentLevel: "beginner",
    confidence: 0,
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
  }
}

export function loadStudentModel(): StudentModel {
  const model = readJson<StudentModel>(STUDENT_MODEL_PATH, defaultStudentModel())
  // Backward compatibility: fill derived fields on old profiles.
  if (!model.frequentStruggles) model.frequentStruggles = []
  if (!model.learningVelocity) model.learningVelocity = "steady"
  return model
}

export function saveStudentModel(model: StudentModel): void {
  ensureDir(GLOBAL_DIR)
  model.lastActiveAt = new Date().toISOString()
  deriveStudentSignals(model)
  writeJson(STUDENT_MODEL_PATH, model)
}

const BLOOM_ORDER: BloomStage[] = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

/**
 * Compressed-memory signals: which topics the student keeps struggling on,
 * and how fast they move up Bloom's taxonomy across recent sessions.
 * Derived on every save so agents read a summary, not the full history.
 */
export function deriveStudentSignals(model: StudentModel): void {
  const struggles: string[] = []
  const misconceptions = model.misconceptions ?? []
  const knowledge = model.knowledge ?? {}

  for (const m of misconceptions) {
    if (!m.resolved && !struggles.includes(m.topic)) struggles.push(m.topic)
  }
  for (const [topic, node] of Object.entries(knowledge)) {
    if ((node.confidence ?? 0) < 30 && !struggles.includes(topic)) struggles.push(topic)
  }

  model.frequentStruggles = struggles.slice(0, 5)
  model.learningVelocity = deriveLearningVelocity(model)
}

function deriveLearningVelocity(model: StudentModel): LearningVelocity {
  const sessions = model.sessions ?? []
  if (sessions.length < 3) return "steady"

  const half = Math.floor(sessions.length / 2)
  const firstHalf = sessions.slice(0, half)
  const secondHalf = sessions.slice(half)

  const avgBloom = (list: SessionSummary[]) =>
    list.reduce((sum, s) => sum + BLOOM_ORDER.indexOf(s.bloomStageReached), 0) / list.length

  const delta = avgBloom(secondHalf) - avgBloom(firstHalf)
  if (delta >= 0.5) return "fast"
  if (delta <= -0.5) return "slow"
  return "steady"
}

export function initStudentModel(name?: string, goal?: string): StudentModel {
  const model = defaultStudentModel()
  if (name) model.name = name
  if (goal) model.learningGoal = goal
  saveStudentModel(model)
  return model
}

export function getOrCreateStudentModel(name?: string, goal?: string): StudentModel {
  const existing = loadStudentModel()
  if (existing.createdAt && existing.createdAt !== new Date().toISOString().slice(0, 10)) {
    return existing
  }
  if (!existing.name && !existing.learningGoal) {
    return initStudentModel(name, goal)
  }
  return existing
}

export function updateKnowledge(
  model: StudentModel,
  topic: string,
  updates: Partial<KnowledgeNode>,
): StudentModel {
  const existing = model.knowledge[topic] || {
    topic,
    level: model.currentLevel,
    confidence: 0,
    lastAssessed: new Date().toISOString(),
    competency: defaultCompetency(),
    bloomStage: "remember" as BloomStage,
    misconceptionNotes: [],
    practiceCount: 0,
    lastPracticed: new Date().toISOString(),
  }

  model.knowledge[topic] = {
    ...existing,
    ...updates,
    lastAssessed: new Date().toISOString(),
  }

  saveStudentModel(model)
  return model
}

export function addMisconception(
  model: StudentModel,
  topic: string,
  description: string,
): StudentModel {
  const misconception: Misconception = {
    topic,
    description,
    detectedAt: new Date().toISOString(),
    resolved: false,
  }
  model.misconceptions.push(misconception)
  saveStudentModel(model)
  return model
}

export function resolveMisconception(
  model: StudentModel,
  topic: string,
): StudentModel {
  const target = model.misconceptions.find(
    m => m.topic === topic && !m.resolved,
  )
  if (target) {
    target.resolved = true
    target.resolvedAt = new Date().toISOString()
    saveStudentModel(model)
  }
  return model
}

export function updateConfidence(
  model: StudentModel,
  newConfidence: number,
): StudentModel {
  model.confidence = Math.max(0, Math.min(100, newConfidence))
  saveStudentModel(model)
  return model
}

export function updateLevel(
  model: StudentModel,
  newLevel: LearningLevel,
): StudentModel {
  model.currentLevel = newLevel
  saveStudentModel(model)
  return model
}

export function addSessionSummary(
  model: StudentModel,
  summary: SessionSummary,
): StudentModel {
  model.sessions.push(summary)
  saveStudentModel(model)
  return model
}

export function updateWeakAreas(
  model: StudentModel,
  areas: string[],
): StudentModel {
  model.weakAreas = [...new Set([...model.weakAreas, ...areas])]
  saveStudentModel(model)
  return model
}

export function updateStrengths(
  model: StudentModel,
  strengths: string[],
): StudentModel {
  model.strengths = [...new Set([...model.strengths, ...strengths])]
  saveStudentModel(model)
  return model
}

export function detectMisconceptionSignals(
  model: StudentModel,
): string[] {
  const unresolved = model.misconceptions.filter(m => !m.resolved)
  return unresolved.map(m => `${m.topic}: ${m.description}`)
}

export function getRecommendedStyle(model: StudentModel): ExplanationStyle {
  const topicCount = Object.keys(model.knowledge).length
  if (topicCount === 0) return model.preferredStyle

  const avgConfidence =
    Object.values(model.knowledge).reduce((s, k) => s + k.confidence, 0) /
    topicCount

  if (avgConfidence < 30) return "example-first"
  if (avgConfidence < 60) return "concept-first"
  if (model.patterns.curiositySignals > model.patterns.frustrationSignals) {
    return "analogy-first"
  }
  return model.preferredStyle
}

export function calculateConfidence(model: StudentModel): number {
  const topicKeys = Object.keys(model.knowledge)
  if (topicKeys.length === 0) return model.confidence

  const assessmentAvg =
    topicKeys.reduce((s, k) => s + model.knowledge[k].confidence, 0) /
    topicKeys.length

  const practiceTotal = topicKeys.reduce(
    (s, k) => s + model.knowledge[k].practiceCount,
    0,
  )
  const practiceRate = Math.min(100, practiceTotal * 10)

  const sessionCount = model.sessions.length
  const consistency = Math.min(100, sessionCount * 15)

  return Math.round(
    assessmentAvg * 0.4 +
      practiceRate * 0.3 +
      model.confidence * 0.2 +
      consistency * 0.1,
  )
}

export function shouldPromoteLevel(model: StudentModel): boolean {
  if (model.confidence < 80) return false

  const topics = Object.values(model.knowledge)
  if (topics.length === 0) return false

  return topics.every(
    t => t.competency.knowledge >= 60 && t.competency.implementation >= 40,
  )
}

export function shouldDemoteLevel(model: StudentModel): boolean {
  if (model.confidence < 40) return true

  const recentSessions = model.sessions.slice(-3)
  const failCount = recentSessions.filter(
    s => s.bloomStageReached === "remember",
  ).length

  return failCount >= 3
}

export function renderStudentModel(model: StudentModel): string {
  const lines: string[] = []
  lines.push(`Student: ${model.name || "Anonymous"}`)
  lines.push(`Level: ${model.currentLevel} | Confidence: ${model.confidence}%`)
  lines.push(`Goal: ${model.learningGoal || "Not set"}`)
  lines.push(`Style: ${model.preferredStyle}`)
  lines.push("")

  const topics = Object.entries(model.knowledge)
  if (topics.length > 0) {
    lines.push("Knowledge Map:")
    for (const [topic, node] of topics) {
      const stars = renderStars(node.competency.knowledge)
      lines.push(`  ${topic}: ${stars} (${node.confidence}%)`)
    }
  }

  const unresolved = model.misconceptions.filter(m => !m.resolved)
  if (unresolved.length > 0) {
    lines.push("")
    lines.push("Active Misconceptions:")
    for (const m of unresolved) {
      lines.push(`  - ${m.topic}: ${m.description}`)
    }
  }

  if (model.strengths.length > 0) {
    lines.push("")
    lines.push(`Strengths: ${model.strengths.join(", ")}`)
  }

  if (model.weakAreas.length > 0) {
    lines.push(`Weak Areas: ${model.weakAreas.join(", ")}`)
  }

  return lines.join("\n")
}

function renderStars(score: number): string {
  const filled = Math.floor(score / 20)
  const empty = 5 - filled
  return "★".repeat(filled) + "☆".repeat(empty)
}
