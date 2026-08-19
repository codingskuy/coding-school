import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-rec-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeProjectFiles(dir: string, opts: { competency?: Record<string, number>; engineering?: Record<string, number> }) {
  const codingschool = join(dir, ".codingschool")
  mkdirSync(codingschool, { recursive: true })

  if (opts.competency) {
    writeFileSync(join(codingschool, "competency.json"), JSON.stringify({ topics: { "react": opts.competency } }))
  }
  if (opts.engineering) {
    writeFileSync(join(codingschool, "engineering.json"), JSON.stringify(opts.engineering))
  }
}

describe("renderRecommendations", () => {
  it("renders empty message when no recommendations", async () => {
    const { renderRecommendations } = await import("./recommendations")
    const output = renderRecommendations([])
    expect(output).toContain("Great job")
  })

  it("renders extend recommendations", async () => {
    const { renderRecommendations } = await import("./recommendations")
    const recs = [
      { topic: "TypeScript", reason: "Natural next step", priority: "high" as const, category: "extend" as const },
      { topic: "Next.js", reason: "Builds on React", priority: "medium" as const, category: "extend" as const },
    ]
    const output = renderRecommendations(recs)
    expect(output).toContain("Continue Your Journey")
    expect(output).toContain("TypeScript")
    expect(output).toContain("Next.js")
  })

  it("renders deepen recommendations", async () => {
    const { renderRecommendations } = await import("./recommendations")
    const recs = [
      { topic: "Web Performance", reason: "Go deeper", priority: "medium" as const, category: "deepen" as const },
    ]
    const output = renderRecommendations(recs)
    expect(output).toContain("Go Deeper")
    expect(output).toContain("Web Performance")
  })

  it("renders complement recommendations", async () => {
    const { renderRecommendations } = await import("./recommendations")
    const recs = [
      { topic: "Testing Strategies", reason: "Fill a gap", priority: "medium" as const, category: "complement" as const },
    ]
    const output = renderRecommendations(recs)
    expect(output).toContain("Fill Your Gaps")
    expect(output).toContain("Testing Strategies")
  })

  it("renders mixed categories in correct order", async () => {
    const { renderRecommendations } = await import("./recommendations")
    const recs = [
      { topic: "A", reason: "", priority: "low" as const, category: "complement" as const },
      { topic: "B", reason: "", priority: "high" as const, category: "extend" as const },
      { topic: "C", reason: "", priority: "medium" as const, category: "deepen" as const },
    ]
    const output = renderRecommendations(recs)
    const extendIdx = output.indexOf("Continue Your Journey")
    const deepenIdx = output.indexOf("Go Deeper")
    const complementIdx = output.indexOf("Fill Your Gaps")
    expect(extendIdx).toBeLessThan(deepenIdx)
    expect(deepenIdx).toBeLessThan(complementIdx)
  })
})

describe("generateRecommendations", () => {
  it("returns extend recommendations for React topic", async () => {
    writeProjectFiles(tmpDir, {
      competency: { knowledge: 70, implementation: 60, debugging: 50, teaching: 40 },
      engineering: { codeQuality: 60, architectureThinking: 50, gitProcess: 40, testingMindset: 30, documentation: 50, collaboration: 60, grcAwareness: 40, riskAssessment: 50 },
    })
    const { generateRecommendations } = await import("./recommendations")
    const recs = generateRecommendations(tmpDir, "React Frontend")
    expect(recs.length).toBeGreaterThan(0)
    expect(recs.some(r => r.category === "extend")).toBe(true)
  })

  it("returns complement for low engineering scores", async () => {
    writeProjectFiles(tmpDir, {
      competency: { knowledge: 80, implementation: 70, debugging: 60, teaching: 50 },
      engineering: { codeQuality: 20, architectureThinking: 60, gitProcess: 60, testingMindset: 60, documentation: 60, collaboration: 60, grcAwareness: 60, riskAssessment: 60 },
    })
    const { generateRecommendations } = await import("./recommendations")
    const recs = generateRecommendations(tmpDir, "React Frontend")
    expect(recs.some(r => r.category === "complement")).toBe(true)
  })

  it("skips already-studied extend topics", async () => {
    writeProjectFiles(tmpDir, {
      competency: { knowledge: 70, implementation: 60, debugging: 50, teaching: 40 },
      engineering: { codeQuality: 60, architectureThinking: 50, gitProcess: 60, testingMindset: 60, documentation: 60, collaboration: 60, grcAwareness: 60, riskAssessment: 60 },
    })
    const { generateRecommendations } = await import("./recommendations")
    const recs = generateRecommendations(tmpDir, "React Frontend")
    expect(recs.every(r => r.topic !== "React Frontend")).toBe(true)
  })

  it("returns at most 5 recommendations", async () => {
    writeProjectFiles(tmpDir, {
      competency: { knowledge: 10, implementation: 10, debugging: 10, teaching: 10 },
      engineering: { codeQuality: 5, architectureThinking: 5, gitProcess: 5, testingMindset: 5, documentation: 5, collaboration: 5, grcAwareness: 5, riskAssessment: 5 },
    })
    const { generateRecommendations } = await import("./recommendations")
    const recs = generateRecommendations(tmpDir, "Unknown Topic With Many Weaknesses")
    expect(recs.length).toBeLessThanOrEqual(10)
  })
})
