import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { resumeSession, parseSessionFile, createOrUpdateSession, getLatestSessionInfo } from "./resume"
import type { SessionData } from "../utils/types"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const createSessionFile = (date: string, data: Partial<SessionData> = {}) => {
  const dir = join(tmpDir, ".codingschool", "sessions")
  mkdirSync(dir, { recursive: true })

  const content = `# Session ${date}

## Topic
${data.topic || "Rust"}

## Level
${data.level || "beginner"}

## Progress
${data.progressPercent ?? 50}%

## Bloom Stage
${data.bloomStage || "remember"}

## Completed Items
${(data.completedItems || ["Variables", "Data Types"]).map(i => `- [x] ${i}`).join("\n")}

## Notes
${(data.notes || ["Understood ownership", "Need more practice with lifetimes"]).map(n => `- ${n}`).join("\n")}

## Last Activity
${data.lastActivity || "2026-07-13T10:00:00.000Z"}
`

  writeFileSync(join(dir, `${date}.md`), content, "utf-8")
}

describe("resumeSession", () => {
  it("returns no session when no file exists", () => {
    const res = resumeSession(tmpDir)
    expect(res.hasSession).toBe(false)
    expect(res.session).toBeNull()
  })

  it("returns session data when today's file exists", () => {
    const today = new Date().toISOString().slice(0, 10)
    createSessionFile(today)
    const res = resumeSession(tmpDir)
    expect(res.hasSession).toBe(true)
    expect(res.session).not.toBeNull()
  })
})

describe("createOrUpdateSession", () => {
  it("creates a session file", () => {
    const data: Omit<SessionData, "lastActivity"> = {
      topic: "Rust",
      level: "beginner",
      progressPercent: 30,
      bloomStage: "understand",
      completedItems: ["Variables"],
      notes: [],
    }
    const path = createOrUpdateSession(tmpDir, data)
    expect(path).toContain(".codingschool/sessions/")
  })
})

describe("getLatestSessionInfo", () => {
  it("returns null when no sessions dir", () => {
    expect(getLatestSessionInfo(tmpDir)).toBeNull()
  })

  it("returns the most recent session", () => {
    createSessionFile("2026-07-12", { topic: "Old" })
    createSessionFile("2026-07-13", { topic: "New" })
    const latest = getLatestSessionInfo(tmpDir)
    expect(latest).not.toBeNull()
    expect(latest!.date).toBe("2026-07-13")
    expect(latest!.data.topic).toBe("New")
  })
})

describe("parseSessionFile", () => {
  it("extracts completedItems from markdown", () => {
    createSessionFile("2026-07-13", {
      completedItems: ["Variables", "Ownership"],
      notes: ["Good progress"],
    })

    const data = parseSessionFile(join(tmpDir, ".codingschool", "sessions", "2026-07-13.md"))
    expect(data.completedItems).toEqual(["Variables", "Ownership"])
  })

  it("extracts notes from markdown", () => {
    createSessionFile("2026-07-13", {
      completedItems: [],
      notes: ["Need more practice"],
    })

    const data = parseSessionFile(join(tmpDir, ".codingschool", "sessions", "2026-07-13.md"))
    expect(data.notes).toContain("Need more practice")
  })

  it("extracts all basic fields", () => {
    createSessionFile("2026-07-13", { topic: "Flutter", level: "intermediate", progressPercent: 75, bloomStage: "apply" })

    const data = parseSessionFile(join(tmpDir, ".codingschool", "sessions", "2026-07-13.md"))
    expect(data.topic).toBe("Flutter")
    expect(data.level).toBe("intermediate")
    expect(data.progressPercent).toBe(75)
    expect(data.bloomStage).toBe("apply")
  })
})
