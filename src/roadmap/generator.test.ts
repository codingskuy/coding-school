import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { createRoadmap, normalizeRoadmapContent, listRoadmapItems, isPhaseProjectItem, isCapstoneSection } from "./generator"

let tmpDir: string

const SAMPLE_CONTENT = `# Rust — Beginner

Status: 🟨 In Progress

---

## Target
Able to use and understand Rust at beginner level.

---

## Theory
- [ ] Variables & Mutability
- [ ] Data Types
- [ ] Ownership & Borrowing

---

## Practice
- [ ] Hello World
- [ ] Calculator

---

## Quiz
- [ ] Quiz 1 — Rust fundamentals

---

## Final Project
- [ ] CLI Tool

---

Progress: 0%
`

const SAMPLE_CONTENT_EXPERT = `# Rust — Expert

Status: 🟨 In Progress

---

## Target
Able to use and understand Rust at expert level.

---

## Theory
- [ ] Unsafe Rust
- [ ] FFI
- [ ] Macros
- [ ] Async/Await internals

---

## Practice
- [ ] Custom Allocator
- [ ] Parser Library

---

## Quiz
- [ ] Quiz 1 — Advanced Rust

---

## Final Project
- [ ] Runtime Implementation

---

Progress: 0%
`

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("normalizeRoadmapContent", () => {
  it("converts numbered lists to checkboxes", () => {
    const out = normalizeRoadmapContent(`## Theory
1. Variables & Mutability
2. Data Types
3) Ownership & Borrowing
`)
    expect(out).toContain("- [ ] Variables & Mutability")
    expect(out).toContain("- [ ] Data Types")
    expect(out).toContain("- [ ] Ownership & Borrowing")
  })

  it("keeps existing checkboxes and normalizes uppercase X", () => {
    const out = normalizeRoadmapContent(`## Theory
- [X] Already Done
- [ ] Pending
`)
    expect(out).toContain("- [x] Already Done")
    expect(out).toContain("- [ ] Pending")
  })

  it("converts bare bullets to checkboxes", () => {
    const out = normalizeRoadmapContent(`## Practice
- Hello World
- Calculator
`)
    expect(out).toContain("- [ ] Hello World")
    expect(out).toContain("- [ ] Calculator")
  })

  it("leaves fenced code blocks untouched", () => {
    const out = normalizeRoadmapContent(`## Theory
\`\`\`
1. not a list item
- keep me
\`\`\`
- [ ] Real item
`)
    expect(out).toContain("1. not a list item")
    expect(out).toContain("- keep me")
    expect(out).toContain("- [ ] Real item")
  })
})

describe("createRoadmap", () => {
  it("writes normalized checkbox content to the file", () => {
    createRoadmap({
      projectDir: tmpDir,
      topic: "Python",
      level: "beginner",
      content: `## Theory\n1. Variables & Data Types\n2. Loops\n\n## Practice\n- Functions\n`,
    })
    const { readFileSync } = require("fs")
    const md = readFileSync(join(tmpDir, ".codingschool", "roadmap", "python", "beginner.md"), "utf-8")
    expect(md).toContain("- [ ] Variables & Data Types")
    expect(md).toContain("- [ ] Loops")
    expect(md).toContain("- [ ] Functions")
    expect(md).not.toContain("1. Variables")
  })

  it("lists items across all level files", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "expert", content: SAMPLE_CONTENT_EXPERT })
    const items = listRoadmapItems(tmpDir, "Rust")
    const texts = items.map(i => i.text)
    expect(texts).toContain("CLI Tool")
    expect(texts).toContain("Runtime Implementation")
  })

  it("writes a markdown file with provided content", () => {
    const path = createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    expect(existsSync(path)).toBe(true)
    expect(path).toContain("beginner.md")
  })

  it("creates progress.json entry", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    const progressPath = join(tmpDir, ".codingschool", "progress.json")
    expect(existsSync(progressPath)).toBe(true)
  })

  it("initializes progress at 0%", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    const { readFileSync } = require("fs")
    const progress = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "progress.json"), "utf-8"))
    expect(progress.topics.Rust.percent).toBe(0)
  })

  it("extracts theory items from content", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    const { readFileSync } = require("fs")
    const progress = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "progress.json"), "utf-8"))
    expect(progress.topics.Rust.theory).toEqual(["Variables & Mutability", "Data Types", "Ownership & Borrowing"])
  })

  it("extracts practice items from content", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    const { readFileSync } = require("fs")
    const progress = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "progress.json"), "utf-8"))
    expect(progress.topics.Rust.practice).toEqual(["Hello World", "Calculator"])
  })

  it("extracts quiz items from content", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    const { readFileSync } = require("fs")
    const progress = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "progress.json"), "utf-8"))
    expect(progress.topics.Rust.quizzes).toContain("Quiz 1 — Rust fundamentals")
  })

  it("handles different content for different levels", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "beginner", content: SAMPLE_CONTENT })
    createRoadmap({ projectDir: tmpDir, topic: "Rust", level: "expert", content: SAMPLE_CONTENT_EXPERT })
    const { readFileSync } = require("fs")
    const progress = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "progress.json"), "utf-8"))
    expect(progress.topics.Rust.theory).toHaveLength(3)
  })
})

describe("isPhaseProjectItem", () => {
  it("matches 'Proyek N: ...' pattern", () => {
    expect(isPhaseProjectItem("Proyek 1: Kalkulator Tip")).toBe(true)
    expect(isPhaseProjectItem("Proyek 3: Layar Profil XML")).toBe(true)
  })

  it("matches 'Project N: ...' pattern", () => {
    expect(isPhaseProjectItem("Project 2: To-Do List")).toBe(true)
  })

  it("matches items with rocket emoji", () => {
    expect(isPhaseProjectItem("Build a REST API 🚀")).toBe(true)
    expect(isPhaseProjectItem("Proyek 5: Aplikasi Cuaca 🚀")).toBe(true)
  })

  it("does not match regular items", () => {
    expect(isPhaseProjectItem("Variables & Mutability")).toBe(false)
    expect(isPhaseProjectItem("Quiz 1 — Rust fundamentals")).toBe(false)
    expect(isPhaseProjectItem("Proyek Final: App Portofolio")).toBe(false)
  })
})

describe("isCapstoneSection", () => {
  it("matches capstone sections", () => {
    expect(isCapstoneSection("Final Project")).toBe(true)
    expect(isCapstoneSection("Capstone")).toBe(true)
    expect(isCapstoneSection("Proyek Final")).toBe(true)
    expect(isCapstoneSection("Proyek Portofolio")).toBe(true)
  })

  it("does not match phase sections", () => {
    expect(isCapstoneSection("Tahap 1: Proyek Pertama")).toBe(false)
    expect(isCapstoneSection("Phase 2: List & Navigasi")).toBe(false)
    expect(isCapstoneSection("Theory")).toBe(false)
    expect(isCapstoneSection("Practice")).toBe(false)
  })
})
