import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { codingschoolDir } from "../utils/paths"
import { writeMarkdown } from "../utils/fs"
import { getProgress } from "../progress/tracker"
import type { ProgressData } from "../utils/types"

function handbookDir(projectDir: string): string {
  return join(codingschoolDir(projectDir), "handbook")
}

function topicHandbookPath(projectDir: string, topic: string): string {
  return join(handbookDir(projectDir), `${topic.toLowerCase().replace(/\s+/g, "-")}.md`)
}

function indexHandbookPath(projectDir: string): string {
  return join(handbookDir(projectDir), "index.md")
}

export function appendTopicEntry(
  projectDir: string,
  topic: string,
  item: string,
  notes: string,
  progress?: ProgressData,
): string {
  const data = progress ?? getProgress(projectDir)
  const tp = data.topics[topic]
  if (!tp) return ""

  const now = new Date()
  const dateStr = now.toISOString().split("T")[0]
  const timeStr = now.toTimeString().split(" ")[0]

  const existingPath = topicHandbookPath(projectDir, topic)
  let previousContent = ""
  if (existsSync(existingPath)) {
    previousContent = readFileSync(existingPath, "utf-8")
  }

  const lines: string[] = []
  if (!previousContent) {
    lines.push(`# ${tp.name} — Learning Notes`)
    lines.push("")
    lines.push("> _This handbook records each learning session with theory summaries and practice notes._")
    lines.push("")
    lines.push("---")
    lines.push("")
  }

  lines.push(`## ${dateStr} ${timeStr}`)
  lines.push("")
  lines.push(`**Topic:** ${item}`)
  lines.push("")
  lines.push(notes)
  lines.push("")
  lines.push(`**Progress:** ${tp.percent}% complete`)
  lines.push("")
  lines.push("---")
  lines.push("")

  const content = previousContent + lines.join("\n")
  writeMarkdown(topicHandbookPath(projectDir, topic), content)
  return content
}

export function generateIndexHandbook(projectDir: string, progress?: ProgressData): string {
  const data = progress ?? getProgress(projectDir)
  const now = new Date().toISOString().split("T")[0]

  const lines: string[] = []
  lines.push("# CodingSchool — Learning Notes")
  lines.push("")
  lines.push(`> Updated: ${now}`)
  lines.push("")
  lines.push("## Topics")
  lines.push("")

  const sorted = Object.entries(data.topics)
    .filter(([_, t]) => t.percent > 0)
    .sort(([_, a], [__, b]) => b.percent - a.percent)

  if (sorted.length > 0) {
    for (const [name, tp] of sorted) {
      const displayName = tp.name || name
      const link = `${name.toLowerCase().replace(/\s+/g, "-")}.md`
      const progressBar = "█".repeat(Math.round(tp.percent / 10)) + "░".repeat(10 - Math.round(tp.percent / 10))
      lines.push(`- [${displayName}](${link}) — ${progressBar} ${tp.percent}%`)
    }
    lines.push("")
  } else {
    lines.push("_No topics have been studied yet._")
    lines.push("")
  }

  lines.push("---")
  lines.push("")
  lines.push("_This handbook is automatically updated every time progress is recorded._")

  const content = lines.join("\n")
  writeMarkdown(indexHandbookPath(projectDir), content)
  return content
}

export function generateHandbook(
  projectDir: string,
  topic: string,
  item: string,
  notes: string,
  progress?: ProgressData,
): { topicPath: string; indexPath: string } {
  const data = progress ?? getProgress(projectDir)

  appendTopicEntry(projectDir, topic, item, notes, data)
  generateIndexHandbook(projectDir, data)

  return {
    topicPath: topicHandbookPath(projectDir, topic),
    indexPath: indexHandbookPath(projectDir),
  }
}
