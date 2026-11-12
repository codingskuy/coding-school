import { readFileSync } from "fs"
import { resolve } from "path"

import { decideWrite, type WriteDecision } from "../gate/check"
import { PERSONAS } from "../personas/definitions"
import type { PersonaId } from "../personas/types"

// Host-neutral claim-gate entrypoint for pre-tool hooks.
//
//   coding-school gate-check [--project-dir <dir>] [--format exit-code|json]
//                            [--scope all|persona] [--persona teacher|coach]
//
// Reads the hook payload (JSON) from stdin. Claude Code shape:
//   { cwd, tool_name, tool_input, agent_type?, ... }
//
// --format exit-code (default): exit 0 = allow, exit 2 = deny with the reason
//   on stderr. Understood by Claude Code, Codewhale and DeepSeek Harness's
//   Claude Code hook bridge.
// --format json: always exit 0, prints { "allow": boolean, "reason": string }.
//
// --scope all (default): gate every write.
// --scope persona: gate only sessions running a CodingSchool persona
//   (agent_type teacher / coach). Used by the Claude Code plugin, whose hooks
//   fire in every session, so it never blocks writes outside CodingSchool.
//
// --persona: the persona of the session, for hosts whose hook payload has no
//   agent_type (DeepSeek Harness mounts a per-persona hook instead).

// File-writing tool names across hosts: Claude Code, OpenCode, Pi, DeepSeek Harness.
const WRITE_TOOLS = new Set([
  "Write", "Edit", "MultiEdit", "NotebookEdit",
  "write", "edit", "strreplace", "apply_patch", "str_replace_editor",
])

export interface GateCheckInput {
  argv: string[]
  stdin: string
  env: Record<string, string | undefined>
  cwd: string
}

export interface GateCheckResult {
  exitCode: number
  stdout: string
  stderr: string
}

interface HookPayload {
  cwd?: unknown
  tool_name?: unknown
  agent_type?: unknown
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

// Claude Code reports plugin agents as "codingschool:teacher", and agents
// copied into .claude/agents as plain "teacher".
function personaFromAgentType(agentType: unknown): PersonaId | undefined {
  if (typeof agentType !== "string") return undefined
  const name = agentType.startsWith("codingschool:") ? agentType.slice("codingschool:".length) : agentType
  return name === "teacher" || name === "coach" ? name : undefined
}

export function evaluate(input: GateCheckInput): WriteDecision {
  let payload: HookPayload = {}
  if (input.stdin.trim() !== "") {
    try {
      const parsed = JSON.parse(input.stdin)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object")
      payload = parsed
    } catch {
      return { allow: false, reason: "CodingSchool: invalid hook input (expected a JSON object on stdin)." }
    }
  }

  if (typeof payload.tool_name === "string" && !WRITE_TOOLS.has(payload.tool_name)) {
    return { allow: true, reason: `Tool "${payload.tool_name}" does not write files.` }
  }

  const persona = personaFromAgentType(flag(input.argv, "--persona") ?? payload.agent_type)
  if (!persona && flag(input.argv, "--scope") === "persona") {
    return { allow: true, reason: "Not a CodingSchool persona session." }
  }
  if (persona && PERSONAS[persona].writePolicy === "never") {
    return { allow: false, reason: `CodingSchool: the ${persona} persona never writes files.` }
  }

  const projectDir = resolve(
    flag(input.argv, "--project-dir")
      ?? input.env.CODINGSCHOOL_PROJECT_DIR
      ?? (typeof payload.cwd === "string" && payload.cwd !== "" ? payload.cwd : undefined)
      ?? input.cwd,
  )
  return decideWrite(projectDir)
}

export function runGateCheck(input: GateCheckInput): GateCheckResult {
  const format = flag(input.argv, "--format") ?? "exit-code"
  if (format !== "exit-code" && format !== "json") {
    return { exitCode: 2, stdout: "", stderr: `CodingSchool: unknown --format "${format}" (use exit-code or json).\n` }
  }
  const scope = flag(input.argv, "--scope") ?? "all"
  if (scope !== "all" && scope !== "persona") {
    return { exitCode: 2, stdout: "", stderr: `CodingSchool: unknown --scope "${scope}" (use all or persona).\n` }
  }
  const decision = evaluate(input)
  if (format === "json") {
    return { exitCode: 0, stdout: JSON.stringify(decision) + "\n", stderr: "" }
  }
  return decision.allow
    ? { exitCode: 0, stdout: "", stderr: "" }
    : { exitCode: 2, stdout: "", stderr: decision.reason + "\n" }
}

export function main(): never {
  let stdin = ""
  try {
    stdin = process.stdin.isTTY ? "" : readFileSync(0, "utf-8")
  } catch {
    stdin = ""
  }
  const result = runGateCheck({ argv: process.argv.slice(2), stdin, env: process.env, cwd: process.cwd() })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  process.exit(result.exitCode)
}
