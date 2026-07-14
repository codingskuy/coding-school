import { existsSync, readFileSync, readdirSync } from "fs"
import { join } from "path"
import { box, text } from "./element-helpers"
import type { ViewNode } from "./element-helpers"

type ThemeColor = unknown

type ThemeLike = {
  readonly primary?: ThemeColor
  readonly accent?: ThemeColor
  readonly error?: ThemeColor
  readonly warning?: ThemeColor
  readonly success?: ThemeColor
  readonly info?: ThemeColor
  readonly text?: ThemeColor
  readonly textMuted?: ThemeColor
  readonly border?: ThemeColor
  readonly borderSubtle?: ThemeColor
  readonly background?: ThemeColor
  readonly backgroundPanel?: ThemeColor
}

type RoadmapDetail = {
  topic: string
  level: string
  percent: number
  status: string
  theory: number
  theoryDone: number
  practice: number
  practiceDone: number
}

type ProgressData = {
  xp: number
  level: number
  topics: Record<string, TopicData>
  global: GlobalMetrics
}

type TopicData = {
  name: string
  percent: number
  theory: string[]
  completedTheory: string[]
  practice: string[]
  completedPractice: string[]
  quizzes: string[]
}

type GlobalMetrics = {
  softwareEngineering: number
  knowledge: number
  practice: number
  architecture: number
}

function findProjectDir(directory: string, worktree: string): string {
  for (const dir of [directory, worktree]) {
    const path = join(dir, ".codingschool", "progress.json")
    if (existsSync(path)) return dir
  }
  return directory
}

function readProgress(projectDir: string): ProgressData | null {
  const path = join(projectDir, ".codingschool", "progress.json")
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch { return null }
}

function parseMdRoadmap(content: string): {
  topic: string
  level: string
  percent: number
  status: string
  theory: number
  theoryDone: number
  practice: number
  practiceDone: number
} {
  const lines = content.split("\n")
  let topic = ""
  let level = ""
  let percent = 0
  let status = "not-started"
  let inTheory = false
  let inPractice = false
  let theory = 0, theoryDone = 0
  let practice = 0, practiceDone = 0

  for (const line of lines) {
    if (line.startsWith("# ")) {
      const parts = line.replace(/^#\s+/, "").split("—").map(s => s.trim())
      topic = parts[0] || ""
      level = parts[1] || ""
    } else if (line.startsWith("## Theory")) {
      inTheory = true; inPractice = false
    } else if (line.startsWith("## Practice")) {
      inTheory = false; inPractice = true
    } else if (line.startsWith("## ")) {
      inTheory = false; inPractice = false
    } else if (line.startsWith("Status:")) {
      if (line.includes("Completed") || line.includes("✅")) status = "completed"
      else if (line.includes("In Progress") || line.includes("🟨")) status = "in-progress"
    } else if (line.match(/^\s*-\s+\[([ x])\]/)) {
      const checked = line.match(/^\s*-\s+\[([ x])\]/)![1] === "x"
      if (inTheory) { theory++; if (checked) theoryDone++ }
      else if (inPractice) { practice++; if (checked) practiceDone++ }
    } else if (line.startsWith("Progress:")) {
      const m = line.match(/Progress:\s*(\d+)%/)
      if (m) percent = parseInt(m[1], 10)
    }
  }

  return { topic, level, percent, status, theory, theoryDone, practice, practiceDone }
}

function readRoadmapsMd(projectDir: string): RoadmapDetail[] {
  const dir = join(projectDir, ".codingschool", "roadmap")
  if (!existsSync(dir)) return []
  const result: RoadmapDetail[] = []
  try {
    const topics = readdirSync(dir)
    for (const topicDir of topics) {
      const topicPath = join(dir, topicDir)
      if (!existsSync(topicPath) || !readdirSync(topicPath).some(f => f.endsWith(".md"))) continue
      const files = readdirSync(topicPath).filter(f => f.endsWith(".md"))
      for (const file of files) {
        const content = readFileSync(join(topicPath, file), "utf-8")
        result.push(parseMdRoadmap(content))
      }
    }
  } catch { return [] }
  return result
}

export function buildCodingSchoolView(
  directory: string,
  worktree: string,
  theme: ThemeLike,
): ViewNode[] {
  const projectDir = findProjectDir(directory, worktree)
  const roadmaps = readRoadmapsMd(projectDir)
  if (roadmaps.length === 0) {
    return []
  }
  const progress = readProgress(projectDir)

  return [
    box({ flexDirection: "column", gap: 1 }, [
      buildProgressSection(progress, theme),
      ...roadmaps.flatMap(r => buildRoadmapSection(r, theme)),
    ]),
  ]
}

function buildProgressSection(progress: ProgressData | null, theme: ThemeLike): ViewNode {
  if (!progress) {
    return section("CodingSchool", theme, [
      text({ fg: theme.textMuted }, "Ask AI mentor to start"),
      text({ fg: theme.textMuted }, "a learning session."),
    ])
  }
  const { xp, level } = progress
  const xpNext = (level + 1) * 1000
  const xpProgress = Math.round((xp / xpNext) * 100)
  const topicCount = Object.keys(progress.topics).length
  const completedTopics = Object.values(progress.topics).filter(t => t.percent >= 100).length

  return section("CodingSchool", theme, [
    text({ fg: theme.text }, `Level ${level}  XP ${xp}/${xpNext}`),
    progressBar(xpProgress, 12),
    text({ fg: theme.textMuted }, `${completedTopics}/${topicCount} topics done`),
  ])
}

function buildRoadmapSection(r: RoadmapDetail, theme: ThemeLike): ViewNode[] {
  const color = r.status === "completed" ? theme.success
    : r.status === "in-progress" ? theme.accent
    : theme.textMuted
  return [
    section(
      r.topic,
      theme,
      [
        text({ fg: theme.textMuted }, `${r.level}  ${r.percent}%`),
        progressBar(r.percent, 12),
        text({ fg: theme.textMuted }, `T ${r.theoryDone}/${r.theory}`),
        r.practice > 0 ? text({ fg: theme.textMuted }, `P ${r.practiceDone}/${r.practice}`) : null,
      ].filter(Boolean) as ViewNode[],
    ),
  ]
}

function section(title: string, theme: ThemeLike, children: readonly ViewNode[]): ViewNode {
  return box({ borderStyle: "single", borderColor: theme.borderSubtle, flexDirection: "column", padding: 1 }, [
    text({ fg: theme.info }, title),
    ...children,
  ])
}

function progressBar(percent: number, width: number): ViewNode {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  const empty = width - filled
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty)
  return text({}, bar)
}
