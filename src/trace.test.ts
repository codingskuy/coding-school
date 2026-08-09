import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { logTrace, traceTool, _tracePathForTest } from "./trace"
import type { TraceEntry } from "./trace"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "trace-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function readTraces(): TraceEntry[] {
  const file = _tracePathForTest(tmpDir)
  if (!existsSync(file)) return []
  return readFileSync(file, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(l => JSON.parse(l) as TraceEntry)
}

describe("traceTool", () => {
  it("records a successful run with sanitized input", async () => {
    const result = await traceTool(tmpDir, "coach", "cs_code_review", {
      code: "const x = 1",
      pattern: "typescript",
      prompt: "review this file at some path",
    }, () => "review done")

    expect(result).toBe("review done")
    const [entry] = readTraces()
    expect(entry.agent).toBe("coach")
    expect(entry.tool).toBe("cs_code_review")
    expect(entry.decision).toBe("complete")
    expect(entry.outcome).toBe("review done")
    expect(entry.input.prompt).toContain("review this file")
    expect(entry.input.code).toBeUndefined()
  })

  it("never writes code or file payloads to the log", async () => {
    await traceTool(tmpDir, "teacher", "cs_claim_submit", {
      files: ["/secret/a.ts"],
      answers: [{ q: "x", score: "correct" }],
      verdict: "pass",
    }, () => "ok")

    const [entry] = readTraces()
    expect(entry.input.files).toBeUndefined()
    expect(entry.input.answers).toBeUndefined()
    expect(entry.input.verdict).toBe("pass")
  })

  it("records errors as decision=error and still rethrows", async () => {
    await expect(
      traceTool(tmpDir, "coach", "cs_grc_scan", { pattern: "x" }, () => {
        throw new Error("boom")
      }),
    ).rejects.toThrow("boom")

    const [entry] = readTraces()
    expect(entry.decision).toBe("error")
    expect(entry.outcome).toContain("boom")
  })

  it("truncates long outcomes", async () => {
    const long = "a".repeat(1000)
    await traceTool(tmpDir, "teacher", "cs_reflect", {}, () => long)
    const [entry] = readTraces()
    expect(entry.outcome.length).toBeLessThan(400)
    expect(entry.outcome.endsWith("…")).toBe(true)
  })
})

describe("logTrace rotation", () => {
  it("renames the log to .1 after 500 lines", () => {
    const file = _tracePathForTest(tmpDir)
    for (let i = 0; i < 500; i++) {
      logTrace(tmpDir, {
        traceId: `t${i}`,
        agent: "teacher",
        tool: "cs_teach_concept",
        timestamp: new Date().toISOString(),
        input: { topic: "React" },
        decision: "complete",
        outcome: "hint",
        durationMs: 1,
      })
    }
    expect(readTraces()).toHaveLength(500)
    logTrace(tmpDir, {
      traceId: "t500",
      agent: "teacher",
      tool: "cs_teach_concept",
      timestamp: new Date().toISOString(),
      input: {},
      decision: "complete",
      outcome: "hint",
      durationMs: 1,
    })
    expect(existsSync(`${file}.1`)).toBe(true)
    expect(readTraces()).toHaveLength(1)
  })
})
