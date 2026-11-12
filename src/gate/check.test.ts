import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { decideWrite } from "./check"

let tmpDir: string
let claimsDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cs-gate-"))
  claimsDir = join(tmpDir, ".codingschool", "claims")
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeClaim(name: string, content: string): void {
  mkdirSync(claimsDir, { recursive: true })
  writeFileSync(join(claimsDir, name), content, "utf-8")
}

describe("decideWrite", () => {
  it("denies when .codingschool does not exist", () => {
    const decision = decideWrite(tmpDir)
    expect(decision.allow).toBe(false)
    expect(decision.reason).toContain("cs_claim_open")
  })

  it("denies when every claim is closed", () => {
    writeClaim("todo.json", JSON.stringify({ status: "passed" }))
    expect(decideWrite(tmpDir).allow).toBe(false)
  })

  it("denies (fail-closed) when the claim file is corrupt", () => {
    writeClaim("todo.json", "{not json")
    expect(decideWrite(tmpDir).allow).toBe(false)
  })

  it("allows when a claim is open", () => {
    writeClaim("todo.json", JSON.stringify({ status: "open" }))
    expect(decideWrite(tmpDir).allow).toBe(true)
  })
})
