import { readJson, writeJson } from "./utils/fs"
import { contextPath } from "./utils/paths"
import { loadEngineering } from "./competency"
import type { EngineeringLevel } from "./utils/types"

export type AgentPhase =
  | "idle"
  | "diagnose"
  | "teach"
  | "practice"
  | "project"
  | "claim"
  | "review"
  | "done"

export interface TeacherInsights {
  misconceptions: string[]
  successfulHintLevel: number
  activeTopic?: string
  lastDiagnosedAt?: string
}

export interface PendingProject {
  topic: string
  items: string[]
  ready: boolean
  type: "phase" | "capstone"
  projectName?: string
  phaseLabel?: string
}

export interface CoachFindings {
  weakDimensions: string[]
  skillGaps: string[]
  readiness?: EngineeringLevel
  lastReviewAt?: string
  lastClaimLevel?: EngineeringLevel
  pendingCapstone?: PendingProject
  completedProject?: { projectName: string; topic?: string; summary: string }
}

export interface SharedAgentContext {
  currentPhase: AgentPhase
  activeTopic?: string
  teacher: TeacherInsights
  coach: CoachFindings
  updatedAt: string
}

export function defaultContext(): SharedAgentContext {
  return {
    currentPhase: "idle",
    teacher: {
      misconceptions: [],
      successfulHintLevel: 1,
    },
    coach: {
      weakDimensions: [],
      skillGaps: [],
    },
    updatedAt: new Date().toISOString(),
  }
}

export function loadContext(projectDir: string): SharedAgentContext {
  return readJson<SharedAgentContext>(contextPath(projectDir), defaultContext())
}

export function saveContext(projectDir: string, ctx: SharedAgentContext): void {
  ctx.updatedAt = new Date().toISOString()
  writeJson(contextPath(projectDir), ctx)
}

/**
 * Teacher announces diagnosis results so Coach (and later Teacher runs)
 * can reuse them. Closes part of the Teacher → Coach gap.
 */
export function announceDiagnosis(
  projectDir: string,
  input: {
    topic: string
    misconceptions: string[]
    successfulHintLevel?: number
  },
): void {
  const ctx = loadContext(projectDir)
  ctx.currentPhase = "teach"
  ctx.activeTopic = input.topic
  ctx.teacher.activeTopic = input.topic
  ctx.teacher.misconceptions = input.misconceptions
  if (input.successfulHintLevel) {
    ctx.teacher.successfulHintLevel = input.successfulHintLevel
  }
  ctx.teacher.lastDiagnosedAt = new Date().toISOString()
  saveContext(projectDir, ctx)
}

/**
 * Coach writes review/scan findings into the shared board so Teacher's
 * scaffolding can focus on the student's actual engineering gaps.
 */
export function announceReviewFindings(
  projectDir: string,
  input: {
    improvements: string[]
    grcFlags: string[]
  },
): void {
  const ctx = loadContext(projectDir)
  ctx.currentPhase = "review"
  ctx.coach.skillGaps = extractSkillGaps(input.improvements, input.grcFlags)
  ctx.coach.weakDimensions = getWeakEngineeringDimensions(projectDir)
  ctx.coach.lastReviewAt = new Date().toISOString()
  saveContext(projectDir, ctx)
}

/**
 * Coach announces the claim outcome so Teacher knows the student's
 * engineering readiness (junior/mid/senior).
 */
export function announceClaimResult(
  projectDir: string,
  level: EngineeringLevel,
): void {
  const ctx = loadContext(projectDir)
  ctx.currentPhase = "review"
  ctx.coach.lastClaimLevel = level
  ctx.coach.readiness = level
  saveContext(projectDir, ctx)
}

/**
 * Compressed signals Teacher reads before teaching: Coach's weak
 * dimensions + skill gaps, plus the student's last claimed level.
 */
export function getTeachingSignals(projectDir: string): string[] {
  const ctx = loadContext(projectDir)
  const lines: string[] = []

  if (ctx.coach.weakDimensions.length > 0) {
    lines.push(
      `Coach findings: student is weak in engineering ${ctx.coach.weakDimensions.join(", ")}. Focus teaching here.`,
    )
  }
  if (ctx.coach.skillGaps.length > 0) {
    lines.push(
      `Coach flags skill gaps: ${ctx.coach.skillGaps.join(", ")}. Weave these into examples.`,
    )
  }
  if (ctx.coach.readiness) {
    lines.push(
      `Student last claimed code at ${ctx.coach.readiness} level — calibrate explanation depth accordingly.`,
    )
  }
  if (ctx.teacher.misconceptions.length > 0) {
    lines.push(
      `Active misconceptions: ${ctx.teacher.misconceptions.join("; ")}. Address before moving on.`,
    )
  }
  if (ctx.coach.completedProject) {
    const proj = ctx.coach.completedProject
    lines.push(
      `Student finished the project "${proj.projectName}" with Coach. ` +
        `Mark the project items done via cs_update_progress (use this summary as notes), ` +
        `then auto-detect the next incomplete phase from the roadmap and continue teaching.\n` +
        `Project summary: ${proj.summary}`,
    )
  }

  return lines
}

/** Coach brief: what Teacher has found, for Coach to read before code gen. */
export function getCoachBriefing(projectDir: string): string[] {
  const ctx = loadContext(projectDir)
  const lines: string[] = []

  if (ctx.teacher.activeTopic) {
    lines.push(
      `Student is learning "${ctx.teacher.activeTopic}" with Teacher.`,
    )
  }
  if (ctx.coach.pendingCapstone) {
    const cap = ctx.coach.pendingCapstone
    const label = cap.type === "phase"
      ? `PHASE PROJECT READY from Teacher's roadmap (topic: ${cap.topic}${cap.phaseLabel ? `, ${cap.phaseLabel}` : ""}).`
      : `CAPSTONE PROJECT READY from Teacher's roadmap (topic: ${cap.topic}).`
    lines.push(
      label +
        (cap.ready
          ? ` Build it with the student using the professional project workflow.`
          : ` Still in progress with Teacher — do NOT build until Teacher says ready.`),
    )
    const name = cap.projectName ? `${cap.projectName}: ` : ""
    lines.push(`Roadmap project items:\n- ${cap.items.map(i => `${name}${i}`).join("\n- ")}`)
  }
  if (ctx.teacher.misconceptions.length > 0) {
    lines.push(
      `Teacher-detected misconceptions: ${ctx.teacher.misconceptions.join("; ")}.`,
    )
  }

  return lines
}

/**
 * Teacher marks a roadmap project (phase project or final capstone) as ready
 * for the Coach agent. Flipping `currentPhase` to "project" signals the handoff.
 */
export function announceCapstone(
  projectDir: string,
  input: {
    topic: string
    items: string[]
    ready: boolean
    type?: "phase" | "capstone"
    projectName?: string
    phaseLabel?: string
  },
): void {
  const ctx = loadContext(projectDir)
  ctx.currentPhase = "project"
  ctx.coach.pendingCapstone = {
    topic: input.topic,
    items: input.items,
    ready: input.ready,
    type: input.type ?? "capstone",
    projectName: input.projectName,
    phaseLabel: input.phaseLabel,
  }
  saveContext(projectDir, ctx)
}

/**
 * Coach announces a finished project so the Teacher can continue:
 * - Phase project: mark items done, then continue to next phase
 * - Capstone: mark Final Project items done, close the roadmap
 */
export function announceProjectComplete(
  projectDir: string,
  input: { projectName: string; topic?: string; summary: string },
): void {
  const ctx = loadContext(projectDir)
  ctx.currentPhase = "done"
  ctx.coach.completedProject = {
    projectName: input.projectName,
    topic: input.topic,
    summary: input.summary,
  }
  ctx.coach.pendingCapstone = undefined
  saveContext(projectDir, ctx)
}

function extractSkillGaps(improvements: string[], grcFlags: string[]): string[] {
  const gaps: string[] = []
  const seen = new Set<string>()

  const add = (s: string) => {
    if (s && !seen.has(s)) {
      seen.add(s)
      gaps.push(s)
    }
  }

  for (const improvement of improvements) {
    const lower = improvement.toLowerCase()
    if (/err|try|catch|throw/.test(lower)) add("error handling")
    if (/comment|doc/.test(lower)) add("documentation")
    if (/type|annotat/.test(lower)) add("type safety")
    if (/magic/.test(lower)) add("named constants")
    if (/console|log/.test(lower)) add("clean output")
    if (/line/.test(lower)) add("code formatting")
  }

  for (const flag of grcFlags) {
    const lower = flag.toLowerCase()
    if (/secret|credential/.test(lower)) add("secrets management")
    if (/url/.test(lower)) add("config-driven values")
    if (/validat|input/.test(lower)) add("input validation")
    if (/sql|injection/.test(lower)) add("SQL injection prevention")
    if (/xss/.test(lower)) add("XSS prevention")
  }

  return gaps.slice(0, 5)
}

function getWeakEngineeringDimensions(projectDir: string): string[] {
  const engineering = loadEngineering(projectDir)
  return Object.entries(engineering)
    .filter(([, score]) => score < 50)
    .sort(([, a], [, b]) => a - b)
    .map(([dim]) => formatDimension(dim))
}

function formatDimension(dim: string): string {
  const names: Record<string, string> = {
    codeQuality: "code quality",
    architectureThinking: "architecture thinking",
    gitProcess: "git process",
    testingMindset: "testing mindset",
    documentation: "documentation",
    collaboration: "collaboration",
    grcAwareness: "GRC awareness",
    riskAssessment: "risk assessment",
  }
  return names[dim] || dim
}
