import { ensureDir, writeJson, readJson } from "../utils/fs"
import { reportsDir } from "../utils/paths"
import { join } from "path"
import type { AssessmentRubric, BloomStage, ProgressData } from "../utils/types"

export interface AssessOptions {
  answers: Record<string, string>
  topic: string
  stage: BloomStage
}

function analyzeResponse(response: string): { depth: number; coverage: number; clarity: number; example: boolean } {
  const lower = response.toLowerCase()

  const hasTechnicalTerms = /\b(interface|implementation|abstraction|polymorphism|inheritance|encapsulation|composition|recursion|iteration|synchronous|asynchronous|concurrent|parallel)\b/.test(lower)
  const hasComparisons = /\b(instead|rather\s+than|compared|vs|versus|whereas|while|advantage|disadvantage|pro|con|benefit|drawback|trade-off)\b/.test(lower)
  const hasStructure = /^(\d+\.|[-*]|first|second|third)\b/m.test(lower)
  const hasCode = /`[^`]+`/.test(response) || /\b(function|class|const|let|var|import|export)\b/.test(lower)
  const hasExample = /\b(example|e\.g\.|for\s+instance|like|such\s+as|for\s+example)\b/.test(lower)

  const wordCount = response.split(/\s+/).length
  const depth = wordCount > 100 ? 85 : wordCount > 50 ? 70 : wordCount > 20 ? 55 : 40
  const coverage = hasTechnicalTerms ? 85 : hasComparisons ? 75 : 60
  const clarity = hasStructure ? 85 : 65
  const example = hasExample || hasCode

  return { depth, coverage, clarity, example }
}

export function assessQuiz(options: AssessOptions): AssessmentRubric {
  const { answers, topic, stage } = options

  const allResponses = Object.values(answers).join(" ")
  const analysis = analyzeResponse(allResponses)

  const theory = analysis.coverage
  const logic = analysis.depth
  const coding = analysis.example ? 80 : 60
  const communication = analysis.clarity
  const bestPractice = analysis.example ? theory - 5 : theory - 15

  const rubric: AssessmentRubric = {
    theory: clamp(theory),
    logic: clamp(logic),
    coding: clamp(coding),
    communication: clamp(communication),
    bestPractice: clamp(bestPractice),
    total: 0,
    weakness: identifyWeakness(analysis, topic),
    feedback: generateFeedback(topic, stage, analysis),
  }

  rubric.total = Math.round(
    (rubric.theory + rubric.logic + rubric.coding + rubric.communication + rubric.bestPractice) / 5,
  )

  return rubric
}

export function renderAssessment(rubric: AssessmentRubric): string {
  return `=== Assessment ===

Theory:         ${renderBar(rubric.theory)} ${rubric.theory}/100
Logic:          ${renderBar(rubric.logic)} ${rubric.logic}/100
Coding:         ${renderBar(rubric.coding)} ${rubric.coding}/100
Communication:  ${renderBar(rubric.communication)} ${rubric.communication}/100
Best Practice:  ${renderBar(rubric.bestPractice)} ${rubric.bestPractice}/100

Total: ${rubric.total}/100

Biggest weakness:
${rubric.weakness}

${rubric.feedback}
`
}

function renderBar(score: number): string {
  const filled = Math.round(score / 10)
  return "█".repeat(filled) + "░".repeat(10 - filled)
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function identifyWeakness(analysis: { depth: number; coverage: number; clarity: number; example: boolean }, topic: string): string {
  if (!analysis.example) {
    return `No code examples or implementation of ${topic}. Try including code snippets to strengthen your argument.`
  }
  if (analysis.coverage < 70) {
    return `Lacks technical terms and comparisons. Use more specific vocabulary about ${topic}.`
  }
  if (analysis.clarity < 70) {
    return `Response structure could be clearer. Use bullet points or separate paragraphs.`
  }
  if (analysis.depth < 60) {
    return `Answer is too shallow. Elaborate more deeply on ${topic}.`
  }
  return `Good understanding overall. To level up, practice consistent best practices for ${topic}.`
}

function generateFeedback(topic: string, stage: BloomStage, analysis: { depth: number; coverage: number; clarity: number; example: boolean }): string {
  switch (stage) {
    case "remember":
      return `You're starting to learn about ${topic}. Try explaining in your own words to strengthen understanding.`
    case "understand":
      if (analysis.coverage < 70) {
        return `Understanding needs more depth. Re-read ${topic} concepts and connect with real examples.`
      }
      return `Good conceptual understanding of ${topic}. Time to implement!`
    case "apply":
      if (!analysis.example) {
        return `Theory seems solid, but no implementation yet. Write ${topic} code and run it.`
      }
      return `Code looks good. Now analyze the weaknesses in your approach.`
    case "analyze":
      return `Sharp analysis! Compare with other approaches to broaden your perspective.`
    case "evaluate":
      return `Solid evaluation! Move to the final stage: build something complete.`
    case "create":
      return `Complete! You've gone through the full Bloom cycle for ${topic}. Outstanding!`
  }
}

export function saveAssessment(
  projectDir: string,
  topic: string,
  rubric: AssessmentRubric,
): string {
  const dir = reportsDir(projectDir)
  ensureDir(dir)
  const path = join(dir, `${topic.toLowerCase().replace(/\s+/g, "-")}.json`)

  const existing = readJson<{ assessments: Array<{ date: string; rubric: AssessmentRubric }> }>(
    path,
    { assessments: [] },
  )

  existing.assessments.push({
    date: new Date().toISOString(),
    rubric,
  })

  writeJson(path, existing)

  const progressPath = join(projectDir, ".codingschool", "progress.json")
  const progress = readJson<ProgressData>(
    progressPath,
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )

  if (rubric.total >= 70 && progress.topics[topic]) {
    progress.topics[topic].currentBloomStage = advanceBloomStage(progress.topics[topic].currentBloomStage)
    progress.xp += 100
  }

  writeJson(progressPath, progress)

  return path
}

function advanceBloomStage(current: BloomStage | null): BloomStage {
  const order: BloomStage[] = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
  if (!current) return "understand"
  const idx = order.indexOf(current)
  if (idx >= order.length - 1) return current
  return order[idx + 1]
}
