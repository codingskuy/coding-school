import { format } from "date-fns"
import { ensureDir, writeMarkdown, readJson, writeJson, isFileExists } from "../utils/fs"
import { sessionsDir, sessionPath } from "../utils/paths"
import type { SessionData, BloomStage } from "../utils/types"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"

export interface ResumeResult {
  hasSession: boolean
  session: SessionData | null
  date: string
}

export function getTodayDate(): string {
  return format(new Date(), "yyyy-MM-dd")
}

export function resumeSession(projectDir: string): ResumeResult {
  const dir = sessionsDir(projectDir)
  ensureDir(dir)

  const today = getTodayDate()
  const todayPath = sessionPath(projectDir, today)

  if (isFileExists(todayPath)) {
    const session = parseSessionFile(todayPath)
    return { hasSession: true, session, date: today }
  }

  return { hasSession: false, session: null, date: today }
}

export function createOrUpdateSession(
  projectDir: string,
  data: Omit<SessionData, "lastActivity">,
): string {
  const today = getTodayDate()
  const path = sessionPath(projectDir, today)
  const sessionData: SessionData = {
    ...data,
    lastActivity: new Date().toISOString(),
  }

  const content = `# Session ${today}

## Topic
${sessionData.topic}

## Level
${sessionData.level}

## Progress
${sessionData.progressPercent}%

## Bloom Stage
${sessionData.bloomStage}

## Completed Items
${sessionData.completedItems.map(i => `- [x] ${i}`).join("\n")}

## Notes
${sessionData.notes.map(n => `- ${n}`).join("\n")}

## Last Activity
${sessionData.lastActivity}
`

  writeMarkdown(path, content)

  return path
}

export function getLatestSessionInfo(projectDir: string): { date: string; data: SessionData } | null {
  const dir = sessionsDir(projectDir)
  if (!isFileExists(dir)) return null

  const files = readdirSync(dir)
    .filter((f: string) => f.endsWith(".md"))
    .sort()
    .reverse()

  if (files.length === 0) return null

  const latest = files[0]
  const date = latest.replace(".md", "")
  const data = parseSessionFile(join(dir, latest))
  return { date, data }
}

export function updateProgressFromSession(projectDir: string, topic: string, progressDelta: number): void {
  const progressPath = join(projectDir, ".codingschool", "progress.json")
  const progress = readJson<Record<string, unknown>>(progressPath, {})
  const data = progress as Record<string, unknown>

  data["last_topic"] = topic
  data["last_updated"] = getTodayDate()

  writeJson(progressPath, data)
}

function parseSessionFile(filePath: string): SessionData {
  const content = readFileSync(filePath, "utf-8")
  const lines = content.split("\n")

  const extractSection = (section: string): string => {
    const idx = lines.findIndex(l => l.trim().startsWith(`## ${section}`))
    if (idx === -1) return ""
    const nextSectionIdx = lines.slice(idx + 1).findIndex(l => l.trim().startsWith("##"))
    if (nextSectionIdx === -1) return lines.slice(idx + 1).join("\n").trim()
    return lines.slice(idx + 1, idx + 1 + nextSectionIdx).join("\n").trim()
  }

  const bloomStageLine = extractSection("Bloom Stage")
  const progressLine = extractSection("Progress")
  const completedSection = extractSection("Completed Items")
  const notesSection = extractSection("Notes")

  const completedItems = completedSection
    ? completedSection.split("\n").map(l => l.replace(/^- \[x\]\s*/, "").trim()).filter(Boolean)
    : []

  const notes = notesSection
    ? notesSection.split("\n").map(l => l.replace(/^-\s*/, "").trim()).filter(Boolean)
    : []

  return {
    topic: extractSection("Topic"),
    level: extractSection("Level"),
    progressPercent: parseInt(progressLine) || 0,
    bloomStage: (bloomStageLine.toLowerCase() as BloomStage) || "remember",
    completedItems,
    notes,
    lastActivity: extractSection("Last Activity"),
  }
}
