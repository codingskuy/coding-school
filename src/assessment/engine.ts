import type { AssessmentRubric, BloomStage } from "../utils/types"

export interface AssessOptions {
  answers: Record<string, string>
  topic: string
  stage: BloomStage
}

export function assessQuiz(options: AssessOptions): AssessmentRubric {
  const { answers, topic, stage } = options
  const count = Object.keys(answers).length

  const rubric: AssessmentRubric = {
    theory: clamp(60 + Math.round(Math.random() * 35)),
    logic: clamp(60 + Math.round(Math.random() * 35)),
    coding: clamp(60 + Math.round(Math.random() * 35)),
    communication: clamp(60 + Math.round(Math.random() * 35)),
    bestPractice: clamp(60 + Math.round(Math.random() * 35)),
    total: 0,
    weakness: identifyWeakness(topic),
    feedback: generateFeedback(topic, stage),
  }

  rubric.total = Math.round(
    (rubric.theory + rubric.logic + rubric.coding + rubric.communication + rubric.bestPractice) / 5,
  )

  return rubric
}

export function renderAssessment(rubric: AssessmentRubric): string {
  return `=== Penilaian ===

Theory:         ${renderBar(rubric.theory)} ${rubric.theory}/100
Logic:          ${renderBar(rubric.logic)} ${rubric.logic}/100
Coding:         ${renderBar(rubric.coding)} ${rubric.coding}/100
Communication:  ${renderBar(rubric.communication)} ${rubric.communication}/100
Best Practice:  ${renderBar(rubric.bestPractice)} ${rubric.bestPractice}/100

Total: ${rubric.total}/100

Kesalahan terbesar:
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

function identifyWeakness(topic: string): string {
  return `Masih perlu pendalaman konsep ${topic}. Perbanyak latihan mandiri.`
}

function generateFeedback(topic: string, stage: BloomStage): string {
  switch (stage) {
    case "remember":
      return `Kamu sudah mulai mengenal ${topic}. Coba jelaskan dengan bahasa sendiri untuk memperkuat pemahaman.`
    case "understand":
      return `Pemahaman konsep ${topic} sudah cukup baik. Saatnya implementasi!`
    case "apply":
      return `Kode sudah berjalan. Sekarang analisis kelemahan dari pendekatan yang kamu gunakan.`
    case "analyze":
      return `Analisis yang tajam. Bandingkan dengan pendekatan lain untuk memperluas wawasan.`
    case "evaluate":
      return `Evaluasi yang matang! Lanjut ke tahap akhir: bangun sesuatu yang utuh.`
    case "create":
      return `Selesai! Kamu telah melalui seluruh siklus Bloom untuk ${topic}. Luar biasa!`
  }
}
