import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join, resolve } from "path"

import { renderPluginFiles, personaTools, MCP_TOOL_WILDCARD } from "./plugin"
import { TEACHER, COACH } from "../personas/definitions"
import pkg from "../../package.json"

const ROOT = resolve(import.meta.dir, "../..")

describe("Claude Code plugin files", () => {
  it("are up to date with the persona definitions (run `bun run gen:claude-code`)", () => {
    for (const [path, content] of Object.entries(renderPluginFiles(pkg.version))) {
      expect(readFileSync(join(ROOT, path), "utf-8")).toBe(content)
    }
  })

  it("are shipped in the npm package", () => {
    expect(pkg.files).toEqual(expect.arrayContaining([".claude-plugin/", "claude-code/", "dist/"]))
  })

  it("keep the manifest version in sync with package.json", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf-8"))
    expect(manifest.version).toBe(pkg.version)
  })

  it("list the plugin in the marketplace from npm", () => {
    const marketplace = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf-8"))
    expect(marketplace.plugins).toEqual([
      expect.objectContaining({ name: "codingschool", source: { source: "npm", package: pkg.name } }),
    ])
  })
})

describe("persona tool access", () => {
  it("never gives Teacher a tool that can write files", () => {
    const tools = personaTools(TEACHER)
    for (const writer of ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"]) expect(tools).not.toContain(writer)
    expect(tools).toContain(MCP_TOOL_WILDCARD)
  })

  it("gives Coach write tools (guarded by the PreToolUse hook)", () => {
    expect(personaTools(COACH)).toEqual(expect.arrayContaining(["Write", "Edit", "Bash", MCP_TOOL_WILDCARD]))
  })
})

describe("plugin manifest wiring", () => {
  const manifest = JSON.parse(renderPluginFiles(pkg.version)[".claude-plugin/plugin.json"])

  it("starts the bundled MCP server for the claude-code platform", () => {
    expect(manifest.mcpServers.cs.args).toEqual(["${CLAUDE_PLUGIN_ROOT}/dist/mcp.js", "--platform", "claude-code"])
  })

  it("gates every file-writing tool, only inside CodingSchool persona sessions", () => {
    const [entry] = manifest.hooks.PreToolUse
    expect(entry.matcher.split("|").sort()).toEqual(["Edit", "MultiEdit", "NotebookEdit", "Write"])
    expect(entry.hooks[0].command).toBe('node "${CLAUDE_PLUGIN_ROOT}/dist/gate-check.js" --scope persona')
  })

  it("points to agent files that exist", () => {
    for (const path of manifest.agents) expect(readFileSync(join(ROOT, path), "utf-8")).toStartWith("---\nname: ")
  })
})
