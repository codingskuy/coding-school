import type { ComprehensionAnswer, ComprehensionScore, EngineeringLevel } from "./utils/types"

export const COMPREHENSION_THRESHOLDS = {
  pass: 75,
  partial: 40,
} as const

const SCORE_WEIGHT: Record<ComprehensionScore, number> = {
  correct: 100,
  partial: 50,
  incorrect: 0,
}

/**
 * Aggregate multi-question comprehension confidence (0-100).
 * Weighted toward the weakest answer so one lucky answer can't carry the gate.
 */
export function computeComprehensionConfidence(qa: ComprehensionAnswer[]): number {
  if (qa.length === 0) return 0
  const scores = qa.map(q => SCORE_WEIGHT[q.score])
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const min = Math.min(...scores)
  // 70% average + 30% weakest answer — rewards consistency, punishes lucky answers.
  return Math.round(avg * 0.7 + min * 0.3)
}

/**
 * Map aggregate confidence to a claim verdict recommendation:
 * pass (>=75), partial-pass-continue (>=40, code stays but Coach keeps watching),
 * fail (<40).
 */
export function recommendVerdict(confidence: number): "pass" | "partial-pass-continue" | "fail" {
  if (confidence >= COMPREHENSION_THRESHOLDS.pass) return "pass"
  if (confidence >= COMPREHENSION_THRESHOLDS.partial) return "partial-pass-continue"
  return "fail"
}

export interface ComprehensionQuestion {
  question: string
  focus: string
}

/**
 * Probing-question bank per engineering level. Coach picks 2-3 of these
 * so the gate is multi-turn instead of a single yes/no.
 */
export function buildComprehensionQuestions(
  level: EngineeringLevel,
  fileNames: string[] = [],
): ComprehensionQuestion[] {
  const fileHint = fileNames.length > 0 ? ` in ${fileNames[0]}` : ""
  const base: Record<EngineeringLevel, ComprehensionQuestion[]> = {
    junior: [
      {
        question: `Explain the first line of the file${fileHint} in your own words — what does this code do?`,
        focus: "basic-read",
      },
      {
        question: `If one of the variables${fileHint} changed its value, what happens to the output?`,
        focus: "cause-effect",
      },
      {
        question: `Where would you add a small feature (e.g. displaying a message)?`,
        focus: "extension",
      },
    ],
    mid: [
      {
        question: `Why is function${fileHint} split up like this? What happens if everything is merged into one?`,
        focus: "decomposition",
      },
      {
        question: `What are the trade-offs of this approach${fileHint} compared to a simpler alternative?`,
        focus: "tradeoffs",
      },
      {
        question: `If the input here is empty or the wrong type, where can the code fail and why?`,
        focus: "edge-cases",
      },
    ],
    senior: [
      {
        question: `Where is the most fragile error-handling spot${fileHint}, and how would you add a fallback?`,
        focus: "robustness",
      },
      {
        question: `Which part could become a bottleneck or performance problem, and how would you measure or fix it?`,
        focus: "performance",
      },
      {
        question: `Per OWASP, what security risks could enter through this part${fileHint}, and how would you mitigate them?`,
        focus: "security",
      },
    ],
  }
  return base[level]
}

/** Score a single answer: explicit understanding > vague > parroting. */
export function scoreAnswer(answer: string, question: string): ComprehensionScore {
  if (!answer || answer.trim().length === 0) return "incorrect"
  const lower = answer.toLowerCase()

  const vagueSignals = /(i understand|yes|understand|ok|got it|i see|makes sense)/.test(lower)
  const demoSignals = /(because|since|means|when|if .* then|steps|line|output|result|so |will|would|it does)/.test(lower)
  const denialSignals = /(i don'?t know|not sure|no idea|unsure|confused|can'?t)/.test(lower)

  if (denialSignals && !demoSignals) return "incorrect"
  if (demoSignals && !vagueSignals) return "correct"
  if (demoSignals || vagueSignals) return "partial"
  return "partial"
}
