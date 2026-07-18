import type { EngineeringCompetency, StudentModel } from "./utils/types"
import { loadStudentModel, saveStudentModel } from "./student-model"
import { loadEngineering, saveEngineering, renderEngineeringCompetency, getEngineeringAverage } from "./competency"

export interface CodeReviewResult {
  score: number
  strengths: string[]
  improvements: string[]
  grcFlags: string[]
  overallFeedback: string
  engineeringDimensions: Partial<EngineeringCompetency>
}

export interface ArchitectureAssessment {
  strengths: string[]
  concerns: string[]
  suggestions: string[]
  riskLevel: "low" | "medium" | "high"
}

export interface GRCScanResult {
  governanceIssues: string[]
  riskItems: string[]
  complianceNotes: string[]
  overallRisk: "low" | "medium" | "high"
}

export function reviewCode(
  projectDir: string,
  code: string,
  context?: string,
): CodeReviewResult {
  const strengths: string[] = []
  const improvements: string[] = []
  const grcFlags: string[] = []
  const dimensions: Partial<EngineeringCompetency> = {}

  const lines = code.split("\n")
  const hasComments = lines.some(l => l.trim().startsWith("//") || l.trim().startsWith("#"))
  const hasLong = lines.some(l => l.length > 120)
  const hasMagic = /\b\d{2,}\b/.test(code.replace(/(?:const|let|var)\s+\w+\s*=\s*\d+/g, ""))
  const hasTodo = /TODO|FIXME|HACK|XXX/i.test(code)
  const hasConsole = /console\.(log|debug|warn|error)/.test(code)
  const hasTest = /test|spec|describe|it\(|expect/.test(code.toLowerCase())
  const hasError = /try|catch|throw|error/i.test(code)
  const hasType = /interface|type |: string|: number|: boolean|: void/.test(code)
  const hasSecret = /password|secret|api[_-]?key|token|credential/i.test(code)
  const hasUrl = /https?:\/\/[^\s]+/.test(code)

  if (hasComments) {
    strengths.push("Code includes comments for clarity")
    dimensions.documentation = 60
  }
  if (hasType) {
    strengths.push("Uses type annotations for safety")
    dimensions.codeQuality = 65
  }
  if (hasError) {
    strengths.push("Includes error handling")
    dimensions.riskAssessment = 60
  }
  if (hasTest) {
    strengths.push("Includes test coverage")
    dimensions.testingMindset = 70
  }

  if (hasLong) {
    improvements.push("Some lines exceed 120 characters — consider breaking them up")
    dimensions.codeQuality = (dimensions.codeQuality || 50) - 10
  }
  if (hasMagic) {
    improvements.push("Magic numbers detected — extract to named constants")
    dimensions.codeQuality = (dimensions.codeQuality || 50) - 15
  }
  if (hasTodo) {
    improvements.push("Contains TODO/FIXME comments — address before shipping")
  }
  if (hasConsole) {
    improvements.push("Console.log statements found — remove for production")
    dimensions.codeQuality = (dimensions.codeQuality || 50) - 5
  }
  if (!hasComments && lines.length > 10) {
    improvements.push("No comments found — add documentation for complex logic")
    dimensions.documentation = 30
  }
  if (!hasError && lines.length > 20) {
    improvements.push("No error handling detected — consider adding try/catch")
    dimensions.riskAssessment = (dimensions.riskAssessment || 50) - 10
  }
  if (!hasType && lines.length > 15) {
    improvements.push("No type annotations — add types for better code safety")
    dimensions.codeQuality = (dimensions.codeQuality || 50) - 10
  }

  if (hasSecret) {
    grcFlags.push("CRITICAL: Potential secrets/credentials found in code — never commit secrets")
    dimensions.codeQuality = 0
  }
  if (hasUrl && !hasComments) {
    grcFlags.push("Hardcoded URLs found — consider using environment variables")
  }

  const score = calculateReviewScore(strengths, improvements, grcFlags)

  const overallFeedback = buildOverallFeedback(score, strengths, improvements, grcFlags)

  return {
    score,
    strengths,
    improvements,
    grcFlags,
    overallFeedback,
    engineeringDimensions: dimensions,
  }
}

function calculateReviewScore(
  strengths: string[],
  improvements: string[],
  grcFlags: string[],
): number {
  let score = 60
  score += strengths.length * 8
  score -= improvements.length * 5
  score -= grcFlags.length * 15
  return Math.max(0, Math.min(100, score))
}

function buildOverallFeedback(
  score: number,
  strengths: string[],
  improvements: string[],
  grcFlags: string[],
): string {
  const lines: string[] = []
  if (score >= 80) {
    lines.push("Excellent code quality! You're demonstrating strong engineering practices.")
  } else if (score >= 60) {
    lines.push("Good code with room for improvement. Focus on the suggestions below.")
  } else if (score >= 40) {
    lines.push("Code needs improvement. Pay attention to the issues flagged.")
  } else {
    lines.push("Significant issues found. Let's work on the fundamentals first.")
  }

  if (grcFlags.length > 0) {
    lines.push("")
    lines.push("**GRC Alert:** Address security/compliance issues immediately.")
  }

  return lines.join("\n")
}

export function assessArchitecture(
  description: string,
  patterns?: string,
): ArchitectureAssessment {
  const lower = description.toLowerCase()
  const strengths: string[] = []
  const concerns: string[] = []
  const suggestions: string[] = []

  if (/separation|single.?responsibility|decouple|modular/i.test(lower)) {
    strengths.push("Demonstrates separation of concerns")
  }
  if (/cache|cache|memoiz/i.test(lower)) {
    strengths.push("Considers caching/performance")
  }
  if (/test|mock|stub/i.test(lower)) {
    strengths.push("Includes testing strategy")
  }
  if (/scale|horizontal|vertical|load.?balanc/i.test(lower)) {
    strengths.push("Thinks about scalability")
  }

  if (/monolith|everything.*one|all.*together/i.test(lower)) {
    concerns.push("Architecture may be too monolithic — consider decomposition")
  }
  if (!/error|fail|retry|fallback/i.test(lower)) {
    concerns.push("No failure handling mentioned — what happens when things go wrong?")
  }
  if (!/test|monitor|log/i.test(lower)) {
    concerns.push("No observability strategy mentioned")
  }

  suggestions.push("Consider the 12-factor app principles for cloud-native design")
  suggestions.push("Document architectural decisions with ADRs (Architecture Decision Records)")

  let riskLevel: "low" | "medium" | "high" = "low"
  if (concerns.length > 2) riskLevel = "high"
  else if (concerns.length > 0) riskLevel = "medium"

  return { strengths, concerns, suggestions, riskLevel }
}

export function scanGRC(
  code: string,
  context?: string,
): GRCScanResult {
  const governanceIssues: string[] = []
  const riskItems: string[] = []
  const complianceNotes: string[] = []

  const hasSecret = /password|secret|api[_-]?key|token|credential|private[_-]?key/i.test(code)
  const hasHardcoded = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(code)
  const hasInput = /req\.body|req\.query|req\.params|input|argv/i.test(code)
  const hasSql = /SELECT|INSERT|UPDATE|DELETE|query/i.test(code)
  const hasXss = /innerHTML|dangerouslySetInnerHTML|document\.write/i.test(code)
  const hasEval = /eval\(|Function\(|exec\(/i.test(code)

  if (hasSecret) {
    governanceIssues.push("Secrets/credentials in code — use environment variables or secret managers")
    riskItems.push("Credential exposure risk — rotate any leaked secrets immediately")
  }
  if (hasHardcoded) {
    governanceIssues.push("Hardcoded infrastructure URLs — use configuration for environments")
  }
  if (hasSql && !/prepared|parameterized|placeholder|\?/.test(code)) {
    riskItems.push("Potential SQL injection — use parameterized queries")
    complianceNotes.push("SQL injection is a OWASP Top 10 vulnerability")
  }
  if (hasXss) {
    riskItems.push("Potential XSS vulnerability — sanitize user input")
    complianceNotes.push("XSS is a OWASP Top 10 vulnerability")
  }
  if (hasEval) {
    riskItems.push("Dynamic code execution — potential code injection risk")
  }
  if (hasInput && !/sanitiz|validat|escape|whitelist/i.test(code)) {
    complianceNotes.push("User input detected without visible validation — add input validation")
  }

  let overallRisk: "low" | "medium" | "high" = "low"
  if (riskItems.length > 1 || governanceIssues.some(g => g.includes("Secret"))) {
    overallRisk = "high"
  } else if (riskItems.length > 0 || governanceIssues.length > 0) {
    overallRisk = "medium"
  }

  return { governanceIssues, riskItems, complianceNotes, overallRisk }
}

export function generateMentoringPlan(
  projectDir: string,
  topic: string,
): string {
  const engineering = loadEngineering(projectDir)
  const avg = getEngineeringAverage(projectDir)

  const lines: string[] = []
  lines.push(`## Mentoring Plan: ${topic}`)
  lines.push("")
  lines.push(`**Overall Engineering Competency:** ${avg}/100`)
  lines.push("")

  const weakDimensions = Object.entries(engineering)
    .filter(([_, v]) => v < 50)
    .sort(([, a], [, b]) => a - b)

  if (weakDimensions.length > 0) {
    lines.push("**Focus Areas (below 50):**")
    for (const [dim, score] of weakDimensions) {
      const name = formatDimensionName(dim)
      lines.push(`- ${name}: ${score}/100 — ${getDimensionAdvice(dim)}`)
    }
    lines.push("")
  }

  const strongDimensions = Object.entries(engineering)
    .filter(([_, v]) => v >= 70)
    .sort(([, a], [, b]) => b - a)

  if (strongDimensions.length > 0) {
    lines.push("**Strengths (70+):**")
    for (const [dim, score] of strongDimensions) {
      lines.push(`- ${formatDimensionName(dim)}: ${score}/100`)
    }
    lines.push("")
  }

  lines.push("**Recommended Focus:**")
  if (engineering.codeQuality < 50) {
    lines.push("1. Practice writing cleaner code — extract functions, name variables well")
  }
  if (engineering.testingMindset < 50) {
    lines.push("2. Write tests for every feature — start with unit tests")
  }
  if (engineering.architectureThinking < 50) {
    lines.push("3. Think about system design — draw diagrams before coding")
  }
  if (engineering.documentation < 50) {
    lines.push("4. Document your decisions — write ADRs and README updates")
  }
  if (engineering.grcAwareness < 50) {
    lines.push("5. Review code for security — check OWASP Top 10")
  }

  return lines.join("\n")
}

function formatDimensionName(key: string): string {
  const names: Record<string, string> = {
    codeQuality: "Code Quality",
    architectureThinking: "Architecture Thinking",
    gitProcess: "Git Process",
    testingMindset: "Testing Mindset",
    documentation: "Documentation",
    collaboration: "Collaboration",
    grcAwareness: "GRC Awareness",
    riskAssessment: "Risk Assessment",
  }
  return names[key] || key
}

function getDimensionAdvice(dimension: string): string {
  const advice: Record<string, string> = {
    codeQuality: "Focus on naming, structure, and removing code smells",
    architectureThinking: "Study design patterns and system design principles",
    gitProcess: "Practice meaningful commits, branching strategies, and code review",
    testingMindset: "Write tests first (TDD) and aim for meaningful coverage",
    documentation: "Document as you go — code comments, README, ADRs",
    collaboration: "Practice pair programming and constructive code review",
    grcAwareness: "Learn about security best practices and compliance requirements",
    riskAssessment: "Think about failure modes and edge cases before coding",
  }
  return advice[dimension] || "Keep practicing"
}

export function updateEngineeringFromReview(
  projectDir: string,
  review: CodeReviewResult,
): void {
  const current = loadEngineering(projectDir)
  const updates = review.engineeringDimensions

  if (updates.codeQuality !== undefined) {
    current.codeQuality = Math.round((current.codeQuality + updates.codeQuality) / 2)
  }
  if (updates.architectureThinking !== undefined) {
    current.architectureThinking = Math.round((current.architectureThinking + updates.architectureThinking) / 2)
  }
  if (updates.testingMindset !== undefined) {
    current.testingMindset = Math.round((current.testingMindset + updates.testingMindset) / 2)
  }
  if (updates.documentation !== undefined) {
    current.documentation = Math.round((current.documentation + updates.documentation) / 2)
  }
  if (updates.riskAssessment !== undefined) {
    current.riskAssessment = Math.round((current.riskAssessment + updates.riskAssessment) / 2)
  }

  saveEngineering(projectDir, current)
}
