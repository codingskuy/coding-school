export interface ProgressData {
  topics: Record<string, TopicProgress>
  global: GlobalMetrics
  xp: number
  level: number
}

export interface TopicProgress {
  name: string
  percent: number
  theory: string[]
  completedTheory: string[]
  practice: string[]
  completedPractice: string[]
  quizzes: string[]
  currentBloomStage: BloomStage | null
}

export interface GlobalMetrics {
  softwareEngineering: number
  knowledge: number
  practice: number
  architecture: number
}

export type BloomStage = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"

export const BLOOM_STAGES: BloomStage[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]

export interface SessionData {
  topic: string
  level: string
  progressPercent: number
  bloomStage: BloomStage
  completedItems: string[]
  notes: string[]
  lastActivity: string
}

export interface RoadmapContract {
  topic: string
  level: string
  status: "not-started" | "in-progress" | "completed"
  target: string
  theory: string[]
  practice: string[]
  quizzes: string[]
  finalProject: string
  progressPercent: number
}

export type CoachChoice = "A" | "B"

export type CoachIntent =
  | "greeting"
  | "learn-topic"
  | "question-roadmap"
  | "question-prerequisite"
  | "complete-task"
  | "status-check"
  | "resume"
  | "achievement"
  | "unknown"

export interface AssessmentRubric {
  theory: number
  logic: number
  coding: number
  communication: number
  bestPractice: number
  total: number
  weakness: string
  feedback: string
}
