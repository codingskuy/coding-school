import { appendFileSync, existsSync, readFileSync, renameSync } from "fs"
import { join } from "path"
import { ensureDir } from "./utils/fs"
import { logsDir } from "./utils/paths"

export type TraceAgent = "teacher" | "coach"

export interface TraceEntry {
  traceId: string
  agent: TraceAgent
  tool: string
  timestamp: string
  input: Record<string, string>
  decision: string
  confidence?: number
  outcome: string
  durationMs: number
}

const MAX_LINES_PER_FILE = 500

/** Keys that carry large payloads (code, notes, structures) — never written to the log. */
const REDACTED_KEYS = new Set([
  "code",
  "content",
  "structure",
  "files",
  "answers",
  "qa",
  "notes",
  "reflectionText",
  "milestones",
  "description",
])

function tracePath(projectDir: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return join(logsDir(projectDir), `${date}.jsonl`)
}

function truncate(value: string, max = 200): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function sanitizeInput(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (REDACTED_KEYS.has(key) || value === undefined || value === null) continue
    if (typeof value === "string") {
      out[key] = truncate(value)
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value)
    }
  }
  return out
}

function rotateIfNeeded(projectDir: string): void {
  const file = tracePath(projectDir)
  if (!existsSync(file)) return
  try {
    const lines = readFileSync(file, "utf-8").split("\n").filter(Boolean).length
    if (lines >= MAX_LINES_PER_FILE) {
      renameSync(file, `${file}.1`)
    }
  } catch {
    // non-fatal — tracing must never break a tool call
  }
}

export function logTrace(projectDir: string, entry: TraceEntry): void {
  try {
    rotateIfNeeded(projectDir)
    ensureDir(logsDir(projectDir))
    appendFileSync(tracePath(projectDir), `${JSON.stringify(entry)}\n`, "utf-8")
  } catch {
    // non-fatal
  }
}

/**
 * Wrap a tool executor with structured tracing. Measures duration, records
 * the input (sanitized), the result, and any explicit decision/confidence.
 */
export async function traceTool<T extends string>(
  projectDir: string,
  agent: TraceAgent,
  toolName: string,
  input: Record<string, unknown>,
  run: () => Promise<T> | T,
): Promise<T> {
  const start = Date.now()
  let outcome = ""
  let error: unknown
  try {
    const result = await run()
    outcome = truncate(result, 300)
    return result
  } catch (err) {
    error = err
    outcome = truncate(err instanceof Error ? err.message : String(err), 300)
    throw err
  } finally {
    logTrace(projectDir, {
      traceId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agent,
      tool: toolName,
      timestamp: new Date().toISOString(),
      input: sanitizeInput(input),
      decision: error ? "error" : "complete",
      outcome,
      durationMs: Date.now() - start,
    })
  }
}

/** Exposed for tests. */
export function _tracePathForTest(projectDir: string): string {
  return tracePath(projectDir)
}
