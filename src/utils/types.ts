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

// ──────────────────────────────────────────────
// v2.0 — AI Engineering Mentor Enhancement
// ──────────────────────────────────────────────

export type LearningLevel = "beginner" | "foundation" | "intermediate" | "advanced" | "expert"

export type ExplanationStyle = "analogy-first" | "code-first" | "concept-first" | "example-first"

export type HelpSeekingBehavior = "independent" | "asks-often" | "never-asks"

export interface CompetencyScores {
  knowledge: number
  implementation: number
  debugging: number
  teaching: number
}

export interface KnowledgeNode {
  topic: string
  level: LearningLevel
  confidence: number
  lastAssessed: string
  competency: CompetencyScores
  bloomStage: BloomStage
  misconceptionNotes: string[]
  practiceCount: number
  lastPracticed: string
}

export interface Misconception {
  topic: string
  description: string
  severity?: "critical" | "warning" | "info"
  detectedAt: string
  resolved: boolean
  resolvedAt?: string
}

export interface SessionSummary {
  date: string
  topic: string
  duration: number
  bloomStageReached: BloomStage
  competencyDelta: Partial<CompetencyScores>
  reflectionNotes: string[]
}

export type LearningVelocity = "fast" | "steady" | "slow"

export interface StudentModel {
  name?: string
  createdAt: string
  lastActiveAt: string
  currentLevel: LearningLevel
  confidence: number
  learningGoal: string
  preferredStyle: ExplanationStyle
  knowledge: Record<string, KnowledgeNode>
  patterns: {
    avgSessionLength: number
    preferredTimeOfDay: string
    helpSeekingBehavior: HelpSeekingBehavior
    frustrationSignals: number
    curiositySignals: number
  }
  sessions: SessionSummary[]
  misconceptions: Misconception[]
  strengths: string[]
  weakAreas: string[]
  // Derived compressed-memory signals (updated on save)
  frequentStruggles: string[]
  learningVelocity: LearningVelocity
}

export interface CompetencyData {
  topics: Record<string, CompetencyScores>
}

export interface EngineeringCompetency {
  codeQuality: number
  architectureThinking: number
  gitProcess: number
  testingMindset: number
  documentation: number
  collaboration: number
  grcAwareness: number
  riskAssessment: number
}

export type CompetencyDimension = keyof CompetencyScores

export type CoachState =
  | "idle"
  | "diagnose"
  | "onboarding"
  | "adapt"
  | "teach"
  | "practice"
  | "scaffold"
  | "assess"
  | "reflect"
  | "remediate"
  | "advance"

export type CoachMode = "teacher" | "coach"

// ──────────────────────────────────────────────
// Timeline — Project Guide
// ──────────────────────────────────────────────

export interface TimelineData {
  projectName: string
  description: string
  techStack: string[]
  milestones: Milestone[]
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  name: string
  status: TimelineStatus
  sprints: Sprint[]
}

export interface Sprint {
  name: string
  status: TimelineStatus
  epics: Epic[]
}

export interface Epic {
  name: string
  status: TimelineStatus
  tasks: Task[]
}

export interface Task {
  name: string
  status: TimelineStatus
  notes?: string
}

export type TimelineStatus = "todo" | "in-progress" | "done" | "blocked"

export type TimelineItemType = "milestone" | "sprint" | "epic" | "task"

// Coach claim gate — pair-programming comprehension model
export type EngineeringLevel = "junior" | "mid" | "senior"

export type ComprehensionScore = "correct" | "partial" | "incorrect"

export interface ComprehensionAnswer {
  question: string
  answer: string
  score: ComprehensionScore
}

export type ClaimVerdict = "pass" | "fail" | "revert" | "partial-pass-continue"

export type ClaimStatus = "open" | "claimed" | "reverted"

export interface ClaimFile {
  path: string
  existed: boolean
  originalContent?: string
}

export interface ClaimRecord {
  projectName: string
  item: string
  status: ClaimStatus
  files: ClaimFile[]
  attempts: number
  successLevel?: EngineeringLevel
  openedAt: string
  resolvedAt?: string
  // Multi-turn grading — per-question comprehension evidence
  qaHistory: ComprehensionAnswer[]
  // Aggregate comprehension confidence (0-100) from qaHistory
  confidence: number
}
