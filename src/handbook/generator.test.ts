import { test, expect, describe } from "bun:test"
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { appendTopicEntry, generateIndexHandbook, generateHandbook } from "./generator"
import { codingschoolDir } from "../utils/paths"
import type { ProgressData } from "../utils/types"

function makeProgress(overrides?: Partial<ProgressData>): ProgressData {
  return {
    topics: {
      "java programming": {
        name: "Java Programming",
        percent: 60,
        theory: ["Variables & Data Types", "Control Flow", "OOP Concepts"],
        completedTheory: ["Variables & Data Types", "Control Flow"],
        practice: ["Hello World", "Calculator", "Bank App"],
        completedPractice: ["Hello World"],
        quizzes: ["Quiz 1: Basics"],
        currentBloomStage: "apply",
      },
    },
    global: {
      softwareEngineering: 60,
      knowledge: 60,
      practice: 40,
      architecture: 30,
    },
    xp: 150,
    level: 1,
    ...overrides,
  }
}

describe("appendTopicEntry", () => {
  test("creates handbook with narrative entry", () => {
    const dir = mkdtempSync(join(tmpdir(), "handbook-test-"))
    const progress = makeProgress()
    const notes = "**Teori:**\nVariables store data. Key types: int, String.\n\n**Praktik:**\n`int x = 10;`"

    const result = appendTopicEntry(dir, "java programming", "Variables & Data Types", notes, progress)

    expect(result).toContain("# Java Programming — Catatan Pembelajaran")
    expect(result).toContain("**Materi:** Variables & Data Types")
    expect(result).toContain("**Teori:**")
    expect(result).toContain("Variables store data")
    expect(result).toContain("**Praktik:**")
    expect(result).toContain("`int x = 10;`")
    expect(result).toContain("**Progress:** 60% selesai")

    const filePath = join(codingschoolDir(dir), "handbook", "java-programming.md")
    expect(existsSync(filePath)).toBe(true)

    rmSync(dir, { recursive: true })
  })

  test("appends multiple entries to same file", () => {
    const dir = mkdtempSync(join(tmpdir(), "handbook-test-"))
    const progress = makeProgress()

    appendTopicEntry(dir, "java programming", "Variables & Data Types", "First notes", progress)
    const result = appendTopicEntry(dir, "java programming", "Control Flow", "Second notes", progress)

    expect(result).toContain("**Materi:** Variables & Data Types")
    expect(result).toContain("**Materi:** Control Flow")
    expect(result).toContain("First notes")
    expect(result).toContain("Second notes")

    rmSync(dir, { recursive: true })
  })

  test("handles empty topic gracefully", () => {
    const dir = mkdtempSync(join(tmpdir(), "handbook-test-"))
    const progress = makeProgress()

    const result = appendTopicEntry(dir, "nonexistent", "item", "notes", progress)
    expect(result).toBe("")

    rmSync(dir, { recursive: true })
  })
})

describe("generateIndexHandbook", () => {
  test("creates index with topic links", () => {
    const dir = mkdtempSync(join(tmpdir(), "handbook-test-"))
    const progress = makeProgress()

    const result = generateIndexHandbook(dir, progress)

    expect(result).toContain("# CodingSchool — Catatan Pembelajaran")
    expect(result).toContain("[Java Programming](java-programming.md)")
    expect(result).toContain("60%")

    const indexPath = join(codingschoolDir(dir), "handbook", "index.md")
    expect(existsSync(indexPath)).toBe(true)

    rmSync(dir, { recursive: true })
  })

  test("handles empty progress", () => {
    const dir = mkdtempSync(join(tmpdir(), "handbook-test-"))
    const progress = makeProgress({ topics: {} })

    const result = generateIndexHandbook(dir, progress)

    expect(result).toContain("# CodingSchool — Catatan Pembelajaran")
    expect(result).toContain("Belum ada topik yang dipelajari")

    rmSync(dir, { recursive: true })
  })
})

describe("generateHandbook", () => {
  test("generates both topic and index files", () => {
    const dir = mkdtempSync(join(tmpdir(), "handbook-test-"))
    const progress = makeProgress()
    const notes = "**Teori:**\nTest\n\n**Praktik:**\nTest"

    const result = generateHandbook(dir, "java programming", "Hello World", notes, progress)

    expect(result.topicPath).toContain("java-programming.md")
    expect(result.indexPath).toContain("index.md")
    expect(existsSync(result.topicPath)).toBe(true)
    expect(existsSync(result.indexPath)).toBe(true)

    const topicContent = readFileSync(result.topicPath, "utf-8")
    expect(topicContent).toContain("# Java Programming — Catatan Pembelajaran")
    expect(topicContent).toContain("**Materi:** Hello World")

    const indexContent = readFileSync(result.indexPath, "utf-8")
    expect(indexContent).toContain("# CodingSchool — Catatan Pembelajaran")

    rmSync(dir, { recursive: true })
  })
})
