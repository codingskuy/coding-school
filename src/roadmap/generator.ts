import { writeMarkdown, ensureDir, readJson, writeJson } from "../utils/fs"
import { roadmapDir, topicRoadmapPath } from "../utils/paths"
import type { ProgressData } from "../utils/types"
import { join } from "path"

export interface CreateRoadmapOptions {
  projectDir: string
  topic: string
  level: "beginner" | "intermediate" | "expert"
}

export function generateLearningContract(options: CreateRoadmapOptions): string {
  const { topic, level } = options
  const title = `${topic} — ${level.charAt(0).toUpperCase() + level.slice(1)}`

  const theoryItems = getTheoryTopics(topic, level)
  const practiceItems = getPracticeTopics(topic, level)

  return `# ${title}

Status: 🟨 In Progress

---

## Target
Mampu menggunakan dan memahami ${topic} secara ${level === "beginner" ? "dasar" : level === "intermediate" ? "menengah" : "lanjutan"}.

---

## Theory
${theoryItems.map(t => `- [ ] ${t}`).join("\n")}

---

## Practice
${practiceItems.map(p => `- [ ] ${p}`).join("\n")}

---

## Quiz
- [ ] Quiz 1
- [ ] Quiz 2

---

## Final Project
- [ ] ${topic} ${level} Project

---

Progress: 0%
`
}

export function createRoadmap(options: CreateRoadmapOptions): string {
  const { projectDir, topic, level } = options

  ensureDir(roadmapDir(projectDir))
  const path = topicRoadmapPath(projectDir, topic.toLowerCase(), level)
  const content = generateLearningContract(options)
  writeMarkdown(path, content)

  const progress = readJson<ProgressData>(
    join(projectDir, ".codingschool", "progress.json"),
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )

  if (!progress.topics[topic]) {
    progress.topics[topic] = {
      name: topic,
      percent: 0,
      theory: getTheoryTopics(topic, level),
      practice: getPracticeTopics(topic, level),
      quizzes: ["Quiz 1", "Quiz 2"],
      currentBloomStage: null,
    }
  }

  writeJson(join(projectDir, ".codingschool", "progress.json"), progress)

  return path
}



function getTheoryTopics(topic: string, level: string): string[] {
  const defaults: string[] = [
    `${topic} Fundamentals`,
    `${topic} Core Concepts`,
    `${topic} Best Practices`,
  ]

  if (level === "intermediate") {
    defaults.push(`${topic} Advanced Patterns`)
  }
  if (level === "expert") {
    defaults.push(`${topic} Internals & Optimization`)
  }

  return defaults
}

function getPracticeTopics(topic: string, level: string): string[] {
  const practices = [`${topic} Basic Implementation`]

  if (level !== "beginner") {
    practices.push(`${topic} Real-world Application`)
  }
  if (level === "expert") {
    practices.push(`${topic} Performance Optimization`)
  }

  return practices
}
