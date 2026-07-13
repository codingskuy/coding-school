import { readJson, writeJson } from "../utils/fs"
import { progressPath } from "../utils/paths"
import type { ProgressData, TopicProgress } from "../utils/types"

export function getProgress(projectDir: string): ProgressData {
  return readJson<ProgressData>(
    progressPath(projectDir),
    {
      topics: {},
      global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 },
      xp: 0,
      level: 1,
    },
  )
}

export interface UpdateProgressOptions {
  projectDir: string
  topic: string
  item: string
  status: "done" | "skipped" | "in-progress"
}

export function updateProgress(options: UpdateProgressOptions): ProgressData {
  const { projectDir, topic, item, status } = options
  const progress = getProgress(projectDir)

  if (!progress.topics[topic]) {
    progress.topics[topic] = {
      name: topic,
      percent: 0,
      theory: [],
      completedTheory: [],
      practice: [],
      completedPractice: [],
      quizzes: [],
      currentBloomStage: null,
    }
  }

  const tp = progress.topics[topic]

  if (status === "done") {
    progress.xp += 50
    if (tp.theory.includes(item) && !tp.completedTheory.includes(item)) {
      tp.completedTheory.push(item)
    }
    if (tp.practice.includes(item) && !tp.completedPractice.includes(item)) {
      tp.completedPractice.push(item)
    }
  }

  recalculatePercent(tp)
  recalculateGlobal(progress)
  recalculateLevel(progress)

  writeJson(progressPath(projectDir), progress)
  return progress
}

export function renderProgressBar(percent: number, width: number = 10): string {
  const filled = Math.round((percent / 100) * width)
  const empty = width - filled
  return "█".repeat(filled) + "░".repeat(empty)
}

export function renderDashboard(progress: ProgressData): string {
  const lines: string[] = []

  const sorted = Object.entries(progress.topics)
    .filter(([_, t]) => t.percent > 0)
    .sort(([_, a], [__, b]) => b.percent - a.percent)

  for (const [_, topic] of sorted) {
    lines.push(`${topic.name.padEnd(30)} ${renderProgressBar(topic.percent)}  ${topic.percent}%`)
  }

  lines.push("")
  lines.push(`Software Engineering    ${renderProgressBar(progress.global.softwareEngineering)}  ${progress.global.softwareEngineering}%`)
  lines.push(`Knowledge               ${renderProgressBar(progress.global.knowledge)}  ${progress.global.knowledge}%`)
  lines.push(`Practice                ${renderProgressBar(progress.global.practice)}  ${progress.global.practice}%`)
  lines.push(`Architecture            ${renderProgressBar(progress.global.architecture)}  ${progress.global.architecture}%`)
  lines.push("")
  lines.push(`XP: ${progress.xp} / ${(progress.level + 1) * 1000}`)
  lines.push(`Level: ${progress.level}`)

  return lines.join("\n")
}

function recalculatePercent(topic: TopicProgress): void {
  const total = topic.theory.length + topic.practice.length + topic.quizzes.length
  if (total === 0) {
    topic.percent = 0
    return
  }
  const doneTheory = topic.completedTheory.length
  const donePractice = topic.completedPractice.length
  const doneTotal = doneTheory + donePractice
  topic.percent = Math.round(doneTotal / total * 100)
}

function recalculateGlobal(progress: ProgressData): void {
  const counts = Object.keys(progress.topics).length
  if (counts === 0) return

  const sum = Object.values(progress.topics).reduce(
    (acc, t) => ({
      se: acc.se + t.percent,
      kn: acc.kn + t.percent,
      pr: acc.pr + t.percent,
      ar: acc.ar + t.percent * 0.5,
    }),
    { se: 0, kn: 0, pr: 0, ar: 0 },
  )

  progress.global = {
    softwareEngineering: Math.round(sum.se / counts),
    knowledge: Math.round(sum.kn / counts),
    practice: Math.round(sum.pr / counts),
    architecture: Math.round(sum.ar / counts),
  }
}

function recalculateLevel(progress: ProgressData): void {
  progress.level = Math.max(1, Math.floor(progress.xp / 1000) + 1)
}
