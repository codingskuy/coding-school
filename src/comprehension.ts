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
        question: `Jelaskan baris pertama file${fileHint} pakai bahasamu sendiri — apa yang dilakukan kode ini?`,
        focus: "basic-read",
      },
      {
        question: `Kalau salah satu variable${fileHint} diubah nilainya, apa yang terjadi pada outputnya?`,
        focus: "cause-effect",
      },
      {
        question: `Di bagian mana kamu akan menambah fitur kecil (misal menampilkan pesan)?`,
        focus: "extension",
      },
    ],
    mid: [
      {
        question: `Kenapa function${fileHint} dipecah seperti ini? Apa yang terjadi kalau semua digabung jadi satu?`,
        focus: "decomposition",
      },
      {
        question: `Apa trade-off dari approach${fileHint} ini dibanding alternatif yang lebih sederhana?`,
        focus: "tradeoffs",
      },
      {
        question: `Kalau input di sini kosong atau salah tipe, di mana kodenya bisa error dan kenapa?`,
        focus: "edge-cases",
      },
    ],
    senior: [
      {
        question: `Di mana titik paling rentan error-handling${fileHint}, dan bagaimana kamu akan menambahkan fallback?`,
        focus: "robustness",
      },
      {
        question: `Bagian mana yang berpotensi jadi bottleneck atau masalah performa, dan bagaimana kamu mengukur/memperbaikinya?`,
        focus: "performance",
      },
      {
        question: `Menurut OWASP, apa risiko keamanan yang bisa masuk lewat bagian${fileHint} ini, dan bagaimana memitigasinya?`,
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

  const vagueSignals = /(iya|ya saya paham|yes|understand|ok|got it|bagus|lumayan)/.test(lower)
  const demoSignals = /(karena|sebab|berarti|ketika|kalau|karena itu|caranya|langkah|step|baris|output|hasil|maka|itu akan)/.test(lower)
  const denialSignals = /(tidak|gak|nggak|don'?t|no idea|entah|bingung)/.test(lower)

  if (denialSignals && !demoSignals) return "incorrect"
  if (demoSignals && !vagueSignals) return "correct"
  if (demoSignals || vagueSignals) return "partial"
  return "partial"
}
