import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  lookupRequirements,
  checkToolInstalled,
  checkMcpConfigured,
  checkRequirements,
  renderRequirementsReport,
} from "./requirements"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-req-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("lookupRequirements", () => {
  it("finds Android by keyword", () => {
    const req = lookupRequirements("Android Development with Kotlin")
    expect(req).not.toBeNull()
    expect(req!.category).toBe("mobile")
    expect(req!.system.length).toBeGreaterThan(0)
  })

  it("finds web by keyword", () => {
    const req = lookupRequirements("React Frontend")
    expect(req).not.toBeNull()
    expect(req!.category).toBe("web")
  })

  it("finds ui/ux by keyword", () => {
    const req = lookupRequirements("UI/UX Design")
    expect(req).not.toBeNull()
    expect(req!.category).toBe("uiux")
  })

  it("finds python by keyword", () => {
    const req = lookupRequirements("Python Data Science")
    expect(req).not.toBeNull()
    expect(req!.category).toBe("data-science")
  })

  it("finds rust by keyword", () => {
    const req = lookupRequirements("Rust Systems Programming")
    expect(req).not.toBeNull()
    expect(req!.category).toBe("rust")
  })

  it("returns null for unknown topic", () => {
    const req = lookupRequirements("Interpretive Dance")
    expect(req).toBeNull()
  })

  it("is case-insensitive", () => {
    const req = lookupRequirements("ANDROID DEVELOPMENT")
    expect(req).not.toBeNull()
    expect(req!.category).toBe("mobile")
  })
})

describe("checkToolInstalled", () => {
  it("detects installed tool (node)", () => {
    const result = checkToolInstalled("which node")
    expect(result.installed).toBe(true)
  })

  it("detects missing tool", () => {
    const result = checkToolInstalled("which nonexistent_tool_xyz_12345")
    expect(result.installed).toBe(false)
  })

  it("gets version when versionFlag provided", () => {
    const result = checkToolInstalled("which node", "--version")
    expect(result.installed).toBe(true)
    expect(result.version).toBeDefined()
    expect(result.version).toMatch(/v?\d+/)
  })
})

describe("checkMcpConfigured", () => {
  it("returns true when MCP server is configured", () => {
    writeFileSync(join(tmpDir, "opencode.json"), JSON.stringify({
      mcp: {
        "chrome-dev-tools-mcp": { type: "local", command: ["npx", "-y", "@anthropic/chrome-devtools-mcp"] },
      },
    }))
    expect(checkMcpConfigured(tmpDir, "chrome-dev-tools-mcp")).toBe(true)
  })

  it("returns false when MCP server is not configured", () => {
    writeFileSync(join(tmpDir, "opencode.json"), JSON.stringify({ mcp: {} }))
    expect(checkMcpConfigured(tmpDir, "chrome-dev-tools-mcp")).toBe(false)
  })

  it("returns false when opencode.json does not exist", () => {
    expect(checkMcpConfigured(tmpDir, "chrome-dev-tools-mcp")).toBe(false)
  })

  it("returns false when MCP server is explicitly disabled", () => {
    writeFileSync(join(tmpDir, "opencode.json"), JSON.stringify({
      mcp: {
        "chrome-dev-tools-mcp": { type: "local", command: ["npx"], enabled: false },
      },
    }))
    expect(checkMcpConfigured(tmpDir, "chrome-dev-tools-mcp")).toBe(false)
  })

  it("returns true when mcp key is missing from config", () => {
    writeFileSync(join(tmpDir, "opencode.json"), JSON.stringify({}))
    expect(checkMcpConfigured(tmpDir, "anything")).toBe(false)
  })
})

describe("checkRequirements", () => {
  it("returns matched=false for unknown topic", () => {
    const report = checkRequirements(tmpDir, "Interpretive Dance")
    expect(report.matched).toBe(false)
    expect(report.system).toHaveLength(0)
    expect(report.mcp).toHaveLength(0)
  })

  it("returns system checks for known topic", () => {
    const report = checkRequirements(tmpDir, "Rust Programming")
    expect(report.matched).toBe(true)
    expect(report.category).toBe("rust")
    expect(report.system.length).toBeGreaterThan(0)
    expect(report.system.some(s => s.name === "Rust")).toBe(true)
  })

  it("counts missing required tools", () => {
    const report = checkRequirements(tmpDir, "Docker DevOps")
    expect(report.matched).toBe(true)
    expect(report.system.some(s => s.name === "Docker")).toBe(true)
  })
})

describe("renderRequirementsReport", () => {
  it("renders no-match message for unknown topic", () => {
    const report = checkRequirements(tmpDir, "Unknown Topic")
    const output = renderRequirementsReport(report)
    expect(output).toContain("No built-in requirements found")
  })

  it("renders system tools for known topic", () => {
    const report = checkRequirements(tmpDir, "Rust Programming")
    const output = renderRequirementsReport(report)
    expect(output).toContain("System Requirements")
    expect(output).toContain("Rust")
  })

  it("renders MCP section when MCPs are defined", () => {
    const report = checkRequirements(tmpDir, "Android Development")
    const output = renderRequirementsReport(report)
    expect(output).toContain("MCP Servers")
  })
})
