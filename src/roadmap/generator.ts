import { writeMarkdown, ensureDir, readJson, writeJson } from "../utils/fs"
import { roadmapDir, topicRoadmapPath } from "../utils/paths"
import type { ProgressData } from "../utils/types"
import { join } from "path"
import { readdirSync, existsSync, readFileSync } from "fs"

export interface CreateRoadmapOptions {
  projectDir: string
  topic: string
  level: "beginner" | "intermediate" | "expert"
  content: string
}

/**
 * Normalizes AI-generated roadmap content so every material item is a
 * checkbox line (`- [ ]` / `- [x]`). Numbered lists (`1.`, `2.`, `1)`) and
 * bare bullets are converted. Fenced code blocks are left untouched.
 */
export function normalizeRoadmapContent(content: string): string {
  const lines = content.split("\n")
  const out: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const checkbox = line.match(/^(\s*)- \[([ xX])\] (.+)/)
    if (checkbox) {
      const checked = checkbox[2] === "x" || checkbox[2] === "X"
      out.push(`${checkbox[1]}- [${checked ? "x" : " "}] ${checkbox[3]}`)
      continue
    }

    const numbered = line.match(/^(\s*)\d+[.)]\s+(.+)/)
    if (numbered) {
      out.push(`${numbered[1]}- [ ] ${numbered[2]}`)
      continue
    }

    const bare = line.match(/^(\s*)-\s+(.+)/)
    if (bare) {
      out.push(`${bare[1]}- [ ] ${bare[2]}`)
      continue
    }

    out.push(line)
  }

  return out.join("\n")
}

export function createRoadmap(options: CreateRoadmapOptions): string {
  const { projectDir, topic, level, content } = options

  ensureDir(roadmapDir(projectDir))
  const path = topicRoadmapPath(projectDir, topic.toLowerCase(), level)
  const normalized = normalizeRoadmapContent(content)
  writeMarkdown(path, normalized)

  const progress = readJson<ProgressData>(
    join(projectDir, ".codingschool", "progress.json"),
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )

  if (!progress.topics[topic]) {
    const theory = extractChecklist(normalized, "Theory")
    const practice = extractChecklist(normalized, "Practice")
    const quizzes = extractChecklist(normalized, "Quiz")
    const finalProject = extractChecklist(normalized, "Final Project")

    progress.topics[topic] = {
      name: topic,
      percent: 0,
      theory,
      practice,
      quizzes: [...quizzes, ...finalProject],
      completedTheory: [],
      completedPractice: [],
      currentItem: theory[0] ?? null,
      lastCompletedItem: null,
      currentBloomStage: null,
    }
  }

  writeJson(join(projectDir, ".codingschool", "progress.json"), progress)

  return path
}

export interface RoadmapItem {
  section: string
  text: string
  checked: boolean
}

export function listRoadmapItems(projectDir: string, topic: string): RoadmapItem[] {
  const dir = roadmapDir(projectDir)
  const topicDir = join(dir, topic.toLowerCase())
  if (!existsSync(topicDir)) return []

  const files = readdirSync(topicDir).filter(f => f.endsWith(".md"))
  if (files.length === 0) return []

  const content = files
    .map(f => readFileSync(join(topicDir, f), "utf-8"))
    .join("\n")
  const lines = content.split("\n")
  const items: RoadmapItem[] = []
  let currentSection = ""

  for (const line of lines) {
    const sectionMatch = line.match(/^## (.+)/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      continue
    }

    const checkMatch = line.match(/^(- \[[ x]\] )(.+)/)
    if (checkMatch) {
      items.push({
        section: currentSection,
        text: checkMatch[2],
        checked: line.startsWith("- [x]"),
      })
    }
  }

  return items
}

function extractChecklist(content: string, section: string): string[] {
  const lines = content.split("\n")
  let inSection = false
  const items: string[] = []

  for (const line of lines) {
    if (line.startsWith(`## ${section}`)) {
      inSection = true
      continue
    }
    if (inSection && line.startsWith("## ")) {
      break
    }
    if (inSection) {
      const match = line.match(/^-\s+\[[ x]\]\s+(.+)/)
      if (match) {
        items.push(match[1])
      }
    }
  }

  return items
}
