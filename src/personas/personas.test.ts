import { describe, it, expect } from "bun:test"

import { PERSONAS, TEACHER, COACH } from "./definitions"
import { renderPrompt } from "./prompts"
import type { Platform } from "../tools/types"
import surface from "../__fixtures__/opencode-surface.json"

const PLATFORMS: Platform[] = ["opencode", "claude-code", "pi", "dsh", "mcp"]

describe("personas", () => {
  it("defines teacher (never writes) and coach (claim-gated)", () => {
    expect(Object.keys(PERSONAS)).toEqual(["teacher", "coach"])
    expect(TEACHER.writePolicy).toBe("never")
    expect(COACH.writePolicy).toBe("claim-gated")
    expect(TEACHER.handoffTo).toBe("coach")
    expect(COACH.handoffTo).toBe("teacher")
    expect(Object.values(PERSONAS).filter(p => p.default)).toEqual([TEACHER])
  })
})

describe("renderPrompt", () => {
  it("is byte-identical to the v2.2.2 prompts on opencode", () => {
    expect(renderPrompt("teacher", "opencode")).toBe(surface.agents.teacher.prompt)
    expect(renderPrompt("coach", "opencode")).toBe(surface.agents.coach.prompt)
  })

  it("leaves no placeholders and no opencode-specific text on other platforms", () => {
    for (const platform of PLATFORMS) {
      for (const persona of ["teacher", "coach"] as const) {
        const prompt = renderPrompt(persona, platform)
        expect(prompt).not.toContain("{{")
        if (platform !== "opencode") expect(prompt).not.toContain("opencode")
      }
    }
  })
})
