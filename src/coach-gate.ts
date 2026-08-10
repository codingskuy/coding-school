import { existsSync, readFileSync, rmSync, writeFileSync } from "fs"
import type {
  ClaimRecord,
  ClaimVerdict,
  ComprehensionAnswer,
  EngineeringLevel,
} from "./utils/types"
import { readJson, writeJson } from "./utils/fs"
import { claimPath, timelinePath } from "./utils/paths"
import { updateTimelineItem } from "./timeline/generator"
import { loadEngineering, saveEngineering } from "./competency"
import { announceClaimResult } from "./context"
import {
  buildComprehensionQuestions,
  computeComprehensionConfidence,
} from "./comprehension"
import { adjustedReexplainLevel } from "./meta"

export interface OpenClaimOptions {
  projectDir: string
  projectName: string
  itemName: string
  files: string[]
}

export interface SubmitClaimOptions {
  projectDir: string
  projectName: string
  itemName: string
  verdict: ClaimVerdict
  level?: EngineeringLevel
  notes?: string
  qa?: ComprehensionAnswer[]
  confidence?: number
}

export const ENGINEERING_LEVELS: Record<EngineeringLevel, { label: string; description: string; bump: number }> = {
  junior: {
    label: "Junior",
    description: "simple, readable solution: one concept per step, few parts, beginner-friendly comments",
    bump: 2,
  },
  mid: {
    label: "Mid",
    description: "idiomatic, structured solution: clear small functions, good naming, clean flow",
    bump: 4,
  },
  senior: {
    label: "Senior",
    description: "robust solution: error handling, input validation, best practices, maintainable and extensible",
    bump: 6,
  },
}

export function openClaim(options: OpenClaimOptions): string {
  const { projectDir, projectName, itemName, files } = options
  if (!existsSync(timelinePath(projectDir, projectName))) {
    return `Project "${projectName}" not found. Initialize it first with cs_timeline_init.`
  }
  if (!files || files.length === 0) {
    return "Provide at least one file path to claim."
  }

  const existing = loadClaims(projectDir, projectName)
  if (existing && existing.status === "open") {
    return `There is already an open claim for item "${existing.item}". Resolve it (pass/fail/revert) before opening a new one.`
  }

  const claim: ClaimRecord = {
    projectName,
    item: itemName,
    status: "open",
    files: files.map(p => {
      const existed = existsSync(p)
      return {
        path: p,
        existed,
        originalContent: existed ? readFileSync(p, "utf-8") : undefined,
      }
    }),
    attempts: 0,
    openedAt: new Date().toISOString(),
    qaHistory: [],
    confidence: 0,
  }

  writeJson(claimPath(projectDir, projectName), claim)
  updateTimelineItem({ projectDir, projectName, itemName, status: "in-progress", notes: "Awaiting user's comprehension proof (comprehension gate)." })

  return `Claim opened for "${itemName}". Initial state of ${claim.files.length} file(s) saved (${claim.files.filter(f => f.existed).length} existing, ${claim.files.filter(f => !f.existed).length} new).

Timeline item is now "in-progress". Next: write code to those files, then run the comprehension gate (3-5 questions). Code is only final once the user "claims" it (pass).`
}

export function submitClaim(options: SubmitClaimOptions): string {
  const { projectDir, projectName, itemName, verdict } = options
  const claim = loadClaims(projectDir, projectName)

  if (!claim) {
    return `No open claim found. Open one first with cs_claim_open for item "${itemName}".`
  }
  if (claim.status !== "open") {
    return `Claim for "${claim.item}" is already resolved (status: ${claim.status}).`
  }
  if (claim.item !== itemName) {
    return `The open claim is for "${claim.item}", not "${itemName}".`
  }

  // Multi-turn grading: persist per-question evidence + aggregate confidence.
  claim.qaHistory = claim.qaHistory ?? []
  claim.confidence = claim.confidence ?? 0
  if (options.qa && options.qa.length > 0) {
    claim.qaHistory = [...claim.qaHistory, ...options.qa]
  }
  if (claim.qaHistory.length > 0) {
    claim.confidence = computeComprehensionConfidence(claim.qaHistory)
  } else if (options.confidence !== undefined) {
    claim.confidence = Math.max(0, Math.min(100, Math.round(options.confidence)))
  }

  if (verdict === "fail") {
    claim.attempts += 1
    const level = adjustedReexplainLevel(projectDir, projectName, options.level ?? levelForAttempt(claim.attempts))
    writeJson(claimPath(projectDir, projectName), claim)
    const nextQuestions = buildComprehensionQuestions(level, claim.files.map(f => f.path))
      .slice(0, 3)
      .map(q => `- ${q.question}`)
      .join("\n")
    return `Understanding not yet proven (attempt ${claim.attempts}, confidence ${claim.confidence}/100).

Re-explain at level **${ENGINEERING_LEVELS[level].label}** in simple language — ${ENGINEERING_LEVELS[level].description}.

Probing questions at level ${ENGINEERING_LEVELS[level].label} for the next attempt:
${nextQuestions}

Then ask via the question tool: "Try again, or should I pull the code (revert)?"
- Try again → answer the new comprehension questions (record the answers in the qa argument of cs_claim_submit).
- Revert → call cs_claim_submit with verdict="revert".`
  }

  if (verdict === "revert") {
    revertClaimFiles(claim)
    claim.status = "reverted"
    claim.resolvedAt = new Date().toISOString()
    writeJson(claimPath(projectDir, projectName), claim)
    updateTimelineItem({
      projectDir,
      projectName,
      itemName,
      status: "todo",
      notes: options.notes || "Reverted — user could not prove understanding of the generated code.",
    })
    return `Code pulled back. ${claim.files.length} file(s) restored to their original state (new ones deleted, existing ones restored).
Timeline item "${itemName}" is back to "todo". (Gate confidence: ${claim.confidence}/100)`
  }

  if (verdict === "partial-pass-continue") {
    claim.attempts += 1
    writeJson(claimPath(projectDir, projectName), claim)
    updateTimelineItem({
      projectDir,
      projectName,
      itemName,
      status: "in-progress",
      notes:
        options.notes ||
        `Partial pass (confidence ${claim.confidence}/100) — code kept, continue with supervision.`,
    })
    const weakAnswers = claim.qaHistory.filter(q => q.score !== "correct")
    const focus = weakAnswers.length > 0
      ? `Focus on fixing: ${weakAnswers.slice(0, 3).map(q => `"${truncate(q.question, 60)}"`).join(", ")}`
      : "Move on to the next item while keeping an eye on understanding."
    return `PARTIAL pass (confidence ${claim.confidence}/100) — below the threshold of 75.

Code is kept, claim stays open. Timeline item "${itemName}" stays "in-progress".
${focus}
Once the student strengthens their understanding, call cs_claim_submit again with verdict="pass" (or "revert" if they fail again).`
  }

  const level = options.level ?? "junior"
  updateEngineeringFromClaim(projectDir, level)
  announceClaimResult(projectDir, level)
  claim.status = "claimed"
  claim.successLevel = level
  claim.resolvedAt = new Date().toISOString()
  writeJson(claimPath(projectDir, projectName), claim)
  updateTimelineItem({
    projectDir,
    projectName,
    itemName,
    status: "done",
    notes: options.notes || `Claimed at level ${ENGINEERING_LEVELS[level].label} (confidence ${claim.confidence}/100).`,
  })
  const lowConfidenceNote =
    claim.confidence > 0 && claim.confidence < 75
      ? `\n\n⚠️ Confidence ${claim.confidence}/100 < 75 — Coach should keep monitoring this understanding in the next review.`
      : ""
  return `Code claimed! The user proved understanding at level **${ENGINEERING_LEVELS[level].label}** (confidence ${claim.confidence}/100).
Engineering competency updated. Timeline item "${itemName}" is done.${lowConfidenceNote}`
}

export function updateEngineeringFromClaim(projectDir: string, level: EngineeringLevel): void {
  const current = loadEngineering(projectDir)
  const bump = ENGINEERING_LEVELS[level].bump
  const clamped = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
  current.collaboration = clamped(current.collaboration + bump)
  current.documentation = clamped(current.documentation + Math.round(bump / 2))
  current.codeQuality = clamped(current.codeQuality + Math.round(bump / 2))
  saveEngineering(projectDir, current)
}

function loadClaims(projectDir: string, projectName: string): ClaimRecord | null {
  return readJson<ClaimRecord | null>(claimPath(projectDir, projectName), null)
}

function revertClaimFiles(claim: ClaimRecord): void {
  for (const file of claim.files) {
    if (file.existed) {
      writeFileSync(file.path, file.originalContent ?? "", "utf-8")
    } else if (existsSync(file.path)) {
      rmSync(file.path, { force: true })
    }
  }
}

function levelForAttempt(attempts: number): EngineeringLevel {
  if (attempts >= 2) return "senior"
  if (attempts === 1) return "mid"
  return "junior"
}

function truncate(value: string, max = 60): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}
