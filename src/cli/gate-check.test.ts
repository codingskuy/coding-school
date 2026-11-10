import { describe, it, expect, beforeEach, afterEach, beforeAll } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { spawnSync } from "child_process"

import { runGateCheck, type GateCheckInput } from "./gate-check"

const ROOT = resolve(import.meta.dir, "../..")
const DIST = join(ROOT, "dist", "gate-check.js")

let tmpDir: string
let otherDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cs-gatecli-"))
  otherDir = mkdtempSync(join(tmpdir(), "cs-gatecli-other-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
  rmSync(otherDir, { recursive: true, force: true })
})

function openClaimIn(dir: string): void {
  mkdirSync(join(dir, ".codingschool", "claims"), { recursive: true })
  writeFileSync(join(dir, ".codingschool", "claims", "todo.json"), JSON.stringify({ status: "open" }))
}

function run(payload: unknown, opts: Partial<GateCheckInput> = {}) {
  return runGateCheck({
    argv: [],
    stdin: typeof payload === "string" ? payload : JSON.stringify(payload),
    env: {},
    cwd: otherDir,
    ...opts,
  })
}

describe("gate-check (exit-code format)", () => {
  it("denies Write without an open claim, telling the agent to call cs_claim_open", () => {
    const r = run({ cwd: tmpDir, tool_name: "Write", tool_input: { file_path: "a.ts" } })
    expect(r.exitCode).toBe(2)
    expect(r.stderr).toContain("cs_claim_open")
    expect(r.stdout).toBe("")
  })

  it("allows Write while a claim is open", () => {
    openClaimIn(tmpDir)
    const r = run({ cwd: tmpDir, tool_name: "Write" })
    expect(r.exitCode).toBe(0)
    expect(r.stderr).toBe("")
  })

  it("covers every host's file-writing tool names", () => {
    for (const tool_name of ["Write", "Edit", "MultiEdit", "NotebookEdit", "write", "edit", "strreplace"]) {
      expect(run({ cwd: tmpDir, tool_name }).exitCode).toBe(2)
    }
  })

  it("allows tools that do not write files", () => {
    for (const tool_name of ["Read", "Grep", "mcp__plugin_codingschool_cs__cs_claim_open"]) {
      expect(run({ cwd: tmpDir, tool_name }).exitCode).toBe(0)
    }
  })

  it("always denies the teacher persona, even with an open claim", () => {
    openClaimIn(tmpDir)
    for (const agent_type of ["teacher", "codingschool:teacher"]) {
      const r = run({ cwd: tmpDir, tool_name: "Write", agent_type })
      expect(r.exitCode).toBe(2)
      expect(r.stderr).toContain("teacher")
    }
    expect(run({ cwd: tmpDir, tool_name: "Write", agent_type: "codingschool:coach" }).exitCode).toBe(0)
  })

  it("fails closed on invalid stdin", () => {
    for (const bad of ["{not json", "[1,2]", "null", "42"]) {
      const r = run(bad)
      expect(r.exitCode).toBe(2)
      expect(r.stderr).toContain("invalid hook input")
    }
  })

  it("denies when the project has no .codingschool directory (no crash)", () => {
    const r = run({ cwd: join(tmpDir, "does-not-exist"), tool_name: "Edit" })
    expect(r.exitCode).toBe(2)
  })

  it("rejects an unknown --format", () => {
    const r = run({ cwd: tmpDir }, { argv: ["--format", "xml"] })
    expect(r.exitCode).toBe(2)
    expect(r.stderr).toContain("--format")
  })
})

describe("gate-check project directory resolution", () => {
  it("prefers --project-dir over env, stdin cwd and process cwd", () => {
    openClaimIn(tmpDir)
    const r = run({ cwd: otherDir, tool_name: "Write" }, {
      argv: ["--project-dir", tmpDir],
      env: { CODINGSCHOOL_PROJECT_DIR: otherDir },
    })
    expect(r.exitCode).toBe(0)
  })

  it("prefers CODINGSCHOOL_PROJECT_DIR over stdin cwd", () => {
    openClaimIn(tmpDir)
    expect(run({ cwd: otherDir, tool_name: "Write" }, { env: { CODINGSCHOOL_PROJECT_DIR: tmpDir } }).exitCode).toBe(0)
  })

  it("falls back to the process cwd when stdin is empty", () => {
    openClaimIn(tmpDir)
    expect(run("", { cwd: tmpDir }).exitCode).toBe(0)
    expect(run("", { cwd: otherDir }).exitCode).toBe(2)
  })
})

describe("gate-check (json format)", () => {
  it("always exits 0 and prints the decision", () => {
    const denied = run({ cwd: tmpDir, tool_name: "Write" }, { argv: ["--format", "json"] })
    expect(denied.exitCode).toBe(0)
    expect(JSON.parse(denied.stdout)).toEqual({ allow: false, reason: expect.stringContaining("cs_claim_open") })
    openClaimIn(tmpDir)
    const allowed = run({ cwd: tmpDir, tool_name: "Write" }, { argv: ["--format", "json"] })
    expect(JSON.parse(allowed.stdout).allow).toBe(true)
  })
})

describe("gate-check built binary", () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      const build = spawnSync("bun", ["build", "src/gate-check.ts", "--outdir", "dist", "--target", "node"], { cwd: ROOT })
      if (build.status !== 0) throw new Error(build.stderr.toString())
    }
  })

  const spawn = (args: string[], payload: unknown) =>
    spawnSync("node", args, { input: JSON.stringify(payload), encoding: "utf-8" })

  it("works via node dist/gate-check.js", () => {
    const denied = spawn([DIST], { cwd: tmpDir, tool_name: "Write" })
    expect(denied.status).toBe(2)
    expect(denied.stderr).toContain("cs_claim_open")
    openClaimIn(tmpDir)
    expect(spawn([DIST], { cwd: tmpDir, tool_name: "Write" }).status).toBe(0)
  })

  it("works via the coding-school CLI subcommand", () => {
    const cli = join(ROOT, "scripts", "cli.mjs")
    expect(spawn([cli, "gate-check"], { cwd: tmpDir, tool_name: "Write" }).status).toBe(2)
    openClaimIn(tmpDir)
    const r = spawn([cli, "gate-check", "--format", "json"], { cwd: tmpDir, tool_name: "Write" })
    expect(r.status).toBe(0)
    expect(JSON.parse(r.stdout).allow).toBe(true)
  })
})
