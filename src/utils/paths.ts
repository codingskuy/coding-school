import { join } from "path"
import { existsSync, readFileSync, readdirSync, statSync } from "fs"

const CODING_SCHOOL_DIR = ".codingschool"

export function getProjectRoot(projectDir: string): string {
  return projectDir
}

export function codingschoolDir(projectDir: string): string {
  return join(getProjectRoot(projectDir), CODING_SCHOOL_DIR)
}

export function roadmapDir(projectDir: string): string {
  return join(codingschoolDir(projectDir), "roadmap")
}

export function topicRoadmapDir(projectDir: string, topic: string): string {
  return join(roadmapDir(projectDir), topic.toLowerCase())
}

export function roadmapTopicsList(projectDir: string): string[] {
  const dir = roadmapDir(projectDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => {
    const full = join(dir, f)
    return statSync(full).isDirectory()
  })
}

export function sessionsDir(projectDir: string): string {
  return join(codingschoolDir(projectDir), "sessions")
}

export function quizzesDir(projectDir: string): string {
  return join(codingschoolDir(projectDir), "quizzes")
}

export function reportsDir(projectDir: string): string {
  return join(codingschoolDir(projectDir), "reports")
}

export function certificatesDir(projectDir: string): string {
  return join(codingschoolDir(projectDir), "certificates")
}

export function profilePath(projectDir: string): string {
  return join(codingschoolDir(projectDir), "profile.md")
}

export function progressPath(projectDir: string): string {
  return join(codingschoolDir(projectDir), "progress.json")
}

export function topicRoadmapPath(projectDir: string, topic: string, level: string): string {
  return join(roadmapDir(projectDir), topic.toLowerCase(), `${level}.md`)
}

export function sessionPath(projectDir: string, date: string): string {
  return join(sessionsDir(projectDir), `${date}.md`)
}

export function isProfileExists(projectDir: string): boolean {
  return existsSync(profilePath(projectDir))
}

export function readProfile(projectDir: string): string | null {
  const p = profilePath(projectDir)
  if (!existsSync(p)) return null
  return readFileSync(p, "utf-8")
}

export function getLatestSessionDate(projectDir: string): string | null {
  const dir = sessionsDir(projectDir)
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse()
  return files.length > 0 ? files[0].replace(".md", "") : null
}
