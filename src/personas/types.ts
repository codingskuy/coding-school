// A persona is what CodingSchool calls Teacher / Coach. Hosts name the same
// concept differently: "primary agent" (OpenCode), "agent" (Claude Code),
// "mode" / "preset" (Pi), "agent preset" (DeepSeek Harness), "prompt" (MCP).
export type PersonaId = "teacher" | "coach"

// never       — the persona must not write files at all.
// claim-gated — writes are allowed only while a comprehension claim is open.
export type WritePolicy = "never" | "claim-gated"

export interface Persona {
  id: PersonaId
  description: string
  writePolicy: WritePolicy
  handoffTo: PersonaId
  default: boolean
}
