import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { generateLearningContract, createRoadmap } from "./generator"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("generateLearningContract", () => {
  it("contains topic and level in title", () => {
    const contract = generateLearningContract({ topic: "Rust", level: "beginner" })
    expect(contract).toContain("Rust")
    expect(contract).toContain("Beginner")
  })

  it("contains Theory section", () => {
    const contract = generateLearningContract({ topic: "Rust", level: "beginner" })
    expect(contract).toContain("## Theory")
  })

  it("contains Practice section", () => {
    const contract = generateLearningContract({ topic: "Rust", level: "beginner" })
    expect(contract).toContain("## Practice")
  })

  it("contains Quiz section", () => {
    const contract = generateLearningContract({ topic: "Rust", level: "beginner" })
    expect(contract).toContain("## Quiz")
  })

  it("contains Final Project section", () => {
    const contract = generateLearningContract({ topic: "Rust", level: "beginner" })
    expect(contract).toContain("## Final Project")
  })

  it("has different content for different levels", () => {
    const beginner = generateLearningContract({ topic: "Rust", level: "beginner" })
    const expert = generateLearningContract({ topic: "Rust", level: "expert" })
    expect(beginner).not.toBe(expert)
  })
})

describe("createRoadmap", () => {
  it("writes a markdown file", () => {
    const path = createRoadmap({ projectDir: tmpDir, topic: "Go", level: "intermediate" })
    expect(existsSync(path)).toBe(true)
    expect(path).toContain("intermediate.md")
  })

  it("creates progress.json entry", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Go", level: "intermediate" })
    const progressPath = join(tmpDir, ".codingschool", "progress.json")
    expect(existsSync(progressPath)).toBe(true)
  })

  it("initializes progress at 0%", () => {
    createRoadmap({ projectDir: tmpDir, topic: "Go", level: "intermediate" })
    const { readFileSync } = require("fs")
    const progress = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "progress.json"), "utf-8"))
    expect(progress.topics.Go.percent).toBe(0)
  })
})
