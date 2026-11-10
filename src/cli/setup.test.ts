import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, resolve } from "path"
import { tmpdir } from "os"
import { spawnSync } from "child_process"

const CLI = resolve(import.meta.dir, "../../scripts/cli.mjs")
const PERMISSION = "mcp__plugin_codingschool_cs__*"

let home: string
let claudeDir: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "cs-setup-"))
  claudeDir = join(home, ".claude")
})

afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

function setup(args: string[], input = "", cwd = home) {
  const r = spawnSync(process.execPath, [CLI, "setup", ...args], {
    cwd,
    input,
    encoding: "utf-8",
    env: { HOME: home, CLAUDE_CONFIG_DIR: claudeDir, PATH: "/usr/bin:/bin", XDG_CONFIG_HOME: join(home, ".config") },
  })
  return { status: r.status, out: r.stdout + r.stderr }
}

const settingsPath = () => join(claudeDir, "settings.json")
const settings = () => JSON.parse(readFileSync(settingsPath(), "utf-8"))

describe("setup --platform", () => {
  it("rejects an unknown platform", () => {
    const r = setup(["--platform", "nope"])
    expect(r.status).toBe(1)
    expect(r.out).toContain("Unknown platform")
  })

  it("keeps the v2.2.2 OpenCode project setup as the default", () => {
    const r = setup(["--project"], "y\n")
    expect(r.status).toBe(0)
    expect(JSON.parse(readFileSync(join(home, "opencode.json"), "utf-8")).plugin).toEqual(["@codingskuy/coding-school"])
  })
})

describe("setup --platform claude-code", () => {
  it("prints the plugin install commands", () => {
    const r = setup(["--platform", "claude-code"])
    expect(r.out).toContain("/plugin marketplace add codingskuy/coding-school")
    expect(r.out).toContain("/plugin install codingschool@codingskuy")
    expect(r.out).toContain("claude --agent codingschool:teacher")
  })

  it("changes nothing without a TTY unless --yes is given", () => {
    const r = setup(["--platform", "claude-code"])
    expect(r.out).toContain("Skipped")
    expect(existsSync(settingsPath())).toBe(false)
  })

  it("--yes allows the CodingSchool tools once, keeping other settings and a backup", () => {
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify({ model: "opus", permissions: { allow: ["Bash(ls:*)"], deny: ["Read(.env)"] } }))
    expect(setup(["--platform", "claude-code", "--yes"]).status).toBe(0)
    expect(settings()).toEqual({ model: "opus", permissions: { allow: ["Bash(ls:*)", PERMISSION], deny: ["Read(.env)"] } })
    expect(JSON.parse(readFileSync(settingsPath() + ".bak", "utf-8")).permissions.allow).toEqual(["Bash(ls:*)"])

    const again = setup(["--platform", "claude-code", "--yes"])
    expect(again.out).toContain("Already allowed")
    expect(settings().permissions.allow).toEqual(["Bash(ls:*)", PERMISSION])
  })

  it("creates the settings file when it does not exist", () => {
    setup(["--platform", "claude-code", "--yes"])
    expect(settings()).toEqual({ permissions: { allow: [PERMISSION] } })
  })

  it("leaves an invalid settings file untouched", () => {
    mkdirSync(claudeDir, { recursive: true })
    writeFileSync(settingsPath(), "{ not json")
    const r = setup(["--platform", "claude-code", "--yes"])
    expect(r.out).toContain("not valid JSON")
    expect(readFileSync(settingsPath(), "utf-8")).toBe("{ not json")
  })
})

describe("setup --platform pi / dsh / mcp", () => {
  it("prints the pi install command when pi is not installed", () => {
    const r = setup(["--platform", "pi", "--yes"])
    expect(r.status).toBe(0)
    expect(r.out).toContain("pi install npm:@codingskuy/coding-school")
    expect(r.out).toContain("/teacher")
  })

  it("writes the DSH presets into DSH_HOME/codingschool with --yes", () => {
    const dshHome = join(home, ".dsh")
    const r = spawnSync(process.execPath, [CLI, "setup", "--platform", "dsh", "--yes"], {
      cwd: home, encoding: "utf-8", env: { HOME: home, DSH_HOME: dshHome, PATH: "/usr/bin:/bin" },
    })
    expect(r.status).toBe(0)
    const patch = JSON.parse(readFileSync(join(dshHome, "codingschool", "codingschool.patch.yml"), "utf-8"))
    expect(patch[0].insert.map((p: any) => p.config.id)).toEqual(["codingschool-teacher", "codingschool-coach"])
    expect(existsSync(join(dshHome, "codingschool", "coach-hooks.json"))).toBe(true)
    expect(r.stdout).toContain("dsh web --patch")
  })

  it("writes nothing for DSH without a TTY or --yes", () => {
    const r = setup(["--platform", "dsh"])
    expect(r.out).toContain("Skipped")
    expect(existsSync(join(home, ".dsh"))).toBe(false)
  })

  for (const platform of ["mcp"]) {
    it(`prints a valid MCP server snippet for ${platform} and explains the gate`, () => {
      const r = setup(["--platform", platform])
      expect(r.status).toBe(0)
      const json = r.out.slice(r.out.indexOf("{"), r.out.lastIndexOf("}") + 1)
      expect(JSON.parse(json).mcpServers.codingschool.args).toEqual(["-y", "@codingskuy/coding-school", "mcp", "--platform", platform])
      expect(r.out).toContain("gate-check")
      expect(r.out).toContain("prompt-only")
    })
  }
})
