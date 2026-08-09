import { existsSync, readdirSync } from "fs"
import { join } from "path"
import { readJson } from "./utils/fs"
import { claimsDir } from "./utils/paths"
import { loadStudentModel } from "./student-model"
import type { ClaimRecord, EngineeringLevel } from "./utils/types"

export interface TopicSuccessStats {
  successRate: number
  confidence: number
  practiceCount: number
  unresolvedMisconceptions: number
}

/**
 * Aggregate learning-success signal for a topic, derived from the student
 * model's compressed knowledge nodes. Used to tune the starting hint level.
 */
export function topicSuccessStats(projectDir: string, topic: string): TopicSuccessStats {
  const model = loadStudentModel()
  const node = model.knowledge[topic]
  if (!node) {
    return {
      successRate: 50,
      confidence: 0,
      practiceCount: 0,
      unresolvedMisconceptions: 0,
    }
  }

  const unresolvedMisconceptions = model.misconceptions.filter(
    m => m.topic === topic && !m.resolved,
  ).length

  let successRate = node.confidence + node.practiceCount * 5
  successRate -= unresolvedMisconceptions * 10
  successRate = Math.max(0, Math.min(100, Math.round(successRate)))

  return {
    successRate,
    confidence: node.confidence,
    practiceCount: node.practiceCount,
    unresolvedMisconceptions,
  }
}

/**
 * Meta-learning tuning for the initial hint level (1 = least help, 5 = most).
 * Struggling topics get more scaffolding (+1); mastered topics get less (-1).
 */
export function scaffoldingOffset(projectDir: string, topic: string): number {
  const { successRate } = topicSuccessStats(projectDir, topic)
  if (successRate < 30) return 1
  if (successRate >= 70) return -1
  return 0
}

export function applyScaffoldingOffset(base: number, offset: number): number {
  return Math.max(1, Math.min(5, base + offset))
}

/** Load every claim record for a project across all past claims. */
export function loadProjectClaims(projectDir: string, projectName: string): ClaimRecord[] {
  const dir = claimsDir(projectDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => readJson<ClaimRecord | null>(join(dir, f), null))
    .filter((c): c is ClaimRecord => c !== null && c.projectName === projectName)
}

/**
 * Poor claim history (reverted claim, or repeated failed attempts) means the
 * student needs gentler pacing — cap the re-explain level so Coach doesn't
 * jump to "senior" explanations too quickly.
 */
export function hasPoorClaimHistory(projectDir: string, projectName: string): boolean {
  const claims = loadProjectClaims(projectDir, projectName)
  if (claims.length === 0) return false
  return claims.some(c => c.status === "reverted") ||
    claims.some(c => c.attempts >= 2)
}

export function adjustedReexplainLevel(
  projectDir: string,
  projectName: string,
  level: EngineeringLevel,
): EngineeringLevel {
  if (!hasPoorClaimHistory(projectDir, projectName)) return level
  // Poor history → never explain above "mid" to keep pacing gentle.
  if (level === "senior") return "mid"
  return level
}
