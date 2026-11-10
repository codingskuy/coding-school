#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs"
import { join, dirname } from "path"
import { spawnSync } from "child_process"
import { createInterface } from "readline"
import { homedir, platform } from "os"

const PACKAGE_NAME = "@codingskuy/coding-school"
const VERSION = "2.2.2"

const BANNER = `
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║           @codingskuy/coding-school v${VERSION.padEnd(5)}         ║
  ║            AI Engineering Mentor — Setup                  ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
`

// ── Options ──────────────────────────────────────────────────────────────

const OPTS = {
  opencode: { label: "OpenCode (Teacher + Coach)", selected: true, disabled: false },
}

const PLATFORMS = ["opencode", "claude-code", "pi", "dsh", "mcp"]

// ── Helpers ──────────────────────────────────────────────────────────────

function ask(label, defaultVal) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`  ${label} [${defaultVal ? "Y" : "n"}] `, answer => {
      rl.close()
      const a = answer.trim().toLowerCase()
      if (a === "y" || a === "yes") resolve(true)
      else if (a === "n" || a === "no") resolve(false)
      else resolve(defaultVal)
    })
  })
}

function readJson(path) {
  try {
    const raw = readFileSync(path, "utf-8")
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(path, data) {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8")
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Config Detection ─────────────────────────────────────────────────────

function findOpencodeJson(startDir) {
  // OpenCode only searches the current directory up to the nearest Git root.
  let dir = startDir
  let reachedGitRoot = existsSync(join(dir, ".git"))
  for (let i = 0; i < 10; i++) {
    for (const name of ["opencode.json", "opencode.jsonc"]) {
      const p = join(dir, name)
      if (existsSync(p)) return p
    }
    const parent = dirname(dir)
    if (parent === dir || reachedGitRoot) break
    dir = parent
    reachedGitRoot = existsSync(join(dir, ".git"))
  }
  return null
}

// Global config lives at ~/.config/opencode/opencode.json on every platform
// (on Windows ~ maps to %USERPROFILE%). OPENCODE_CONFIG overrides the default.
function globalConfigCandidates() {
  if (process.env.OPENCODE_CONFIG) {
    return [process.env.OPENCODE_CONFIG]
  }
  if (platform() === "win32") {
    const home = process.env.USERPROFILE || homedir()
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming")
    return [
      join(home, ".config", "opencode", "opencode.json"),
      join(appData, "opencode", "opencode.json"),
    ]
  }
  const home = homedir()
  const xdg = process.env.XDG_CONFIG_HOME
  const base = xdg ? join(xdg, "opencode") : join(home, ".config", "opencode")
  return [join(base, "opencode.json")]
}

function getGlobalConfigPath() {
  const candidates = globalConfigCandidates()
  return candidates.find(p => existsSync(p)) || candidates[0]
}

function detectScope() {
  if (process.argv.includes("--global")) return { scope: "global" }
  if (process.argv.includes("--project")) {
    return { scope: "project", root: process.env.INIT_CWD || process.cwd() }
  }
  // Default: global scope — register once, works in every project.
  return { scope: "global" }
}

function getConfigPath(scope, root) {
  if (scope === "global") return getGlobalConfigPath()
  // Project scope: reuse an existing opencode.json or create one in the root.
  const found = findOpencodeJson(root)
  if (found) return found
  return join(root, "opencode.json")
}

function hasPluginEntry(config) {
  if (!Array.isArray(config.plugin)) return false
  return config.plugin.some(entry => {
    if (typeof entry === "string") return entry === PACKAGE_NAME || entry.startsWith(PACKAGE_NAME + "@")
    if (Array.isArray(entry)) return entry[0] === PACKAGE_NAME || entry[0].startsWith(PACKAGE_NAME + "@")
    return false
  })
}

function addPluginEntry(config) {
  if (!Array.isArray(config.plugin)) {
    config.plugin = [PACKAGE_NAME]
    return "created"
  }
  config.plugin.push(PACKAGE_NAME)
  return "added"
}

function reportAlreadyRegistered() {
  console.log("  ✓ CodingSchool already registered in plugin[].\n")
  console.log('  Restart opencode (or run "opencode reload") to apply.\n')
}

function reportSuccess(scope) {
  console.log("  ─────────────────────────────────────────────\n")
  console.log("  ✅ Setup complete!\n")
  console.log("  Next step: restart opencode to apply changes.\n")
  if (scope === "global") {
    console.log("  Tip: CodingSchool is now registered globally for every project.\n")
    console.log("       For a single project only, run from inside that project:\n")
    console.log("       npx @codingskuy/coding-school setup --project\n")
  }
}

function printManualSetup(configPath) {
  const dir = dirname(configPath)
  const mkdirCmd =
    platform() === "win32"
      ? `New-Item -ItemType Directory -Force "${dir}"`
      : `mkdir -p "${dir}"`

  console.log("  ─────────────────────────────────────────────\n")
  console.log(`  ✗ Global config not found:\n`)
  console.log(`    ${configPath}\n`)
  console.log("  Manual setup — create opencode.json with the plugin entry:\n")
  console.log('    {')
  console.log('      "$schema": "https://opencode.ai/config.json",')
  console.log(`      "plugin": ["${PACKAGE_NAME}"]`)
  console.log('    }\n')
  console.log("  Steps:")
  console.log(`    1. ${mkdirCmd}`)
  console.log(`    2. Create "${configPath}" and paste the JSON above`)
  console.log("    3. Restart opencode to apply changes.\n")
}

// ── Setup Flow ───────────────────────────────────────────────────────────

async function runSetup() {
  console.log(BANNER)

  // 1. Select AI tools
  console.log("  Select AI Tools:\n")
  const selections = {}
  for (const [key, opt] of Object.entries(OPTS)) {
    if (opt.disabled) {
      console.log(`  ${opt.label} — coming soon`)
      selections[key] = false
    } else {
      const val = await ask(`Enable ${opt.label}?`, opt.selected)
      selections[key] = val
    }
  }

  const enabledList = Object.entries(selections)
    .filter(([, v]) => v)
    .map(([k]) => OPTS[k].label)

  console.log(`\n  ✓ Enabled: ${enabledList.length > 0 ? enabledList.join(", ") : "none"}`)
  console.log()

  // 2. Detect scope (default: global)
  console.log("  Detecting scope...\n")
  const { scope, root } = detectScope()
  console.log(`  → Scope: ${scope}`)
  console.log()

  // 3. Find the opencode.json path
  const configPath = getConfigPath(scope, root)
  console.log(`  → Config: ${configPath}`)
  console.log()

  // Global scope: only modify an existing config; otherwise guide manual setup.
  if (scope === "global") {
    const existing = readJson(configPath)
    if (!existing) {
      printManualSetup(configPath)
      return
    }
    if (hasPluginEntry(existing)) {
      reportAlreadyRegistered()
      return
    }
    const action = addPluginEntry(existing)
    writeJson(configPath, existing)
    if (action === "created") {
      console.log(`  ✓ Created plugin[] and added ${PACKAGE_NAME}\n`)
    } else {
      console.log(`  ✓ Added ${PACKAGE_NAME} to plugin[]\n`)
    }
    reportSuccess(scope)
    return
  }

  // Project scope: reuse an existing config or create one in the project root.
  let existing = readJson(configPath)
  if (existing) {
    if (hasPluginEntry(existing)) {
      reportAlreadyRegistered()
      return
    }
    const action = addPluginEntry(existing)
    writeJson(configPath, existing)
    if (action === "created") {
      console.log(`  ✓ Created plugin[] and added ${PACKAGE_NAME}\n`)
    } else {
      console.log(`  ✓ Added ${PACKAGE_NAME} to plugin[]\n`)
    }
  } else {
    const config = {
      $schema: "https://opencode.ai/config.json",
      plugin: [PACKAGE_NAME],
    }
    writeJson(configPath, config)
    console.log("  ✓ Created project opencode.json with CodingSchool\n")
  }

  reportSuccess(scope)
}


// ── Other Platforms ──────────────────────────────────────────────────────

const MARKETPLACE = "codingskuy/coding-school"
const CLAUDE_TOOL_PERMISSION = "mcp__plugin_codingschool_cs__*"

function flagValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

// --yes accepts every prompt; without a TTY nothing is changed unless --yes.
async function confirm(label) {
  if (process.argv.includes("--yes")) return true
  if (!process.stdin.isTTY) return false
  return ask(label, true)
}

function hasCommand(cmd) {
  const probe = platform() === "win32" ? "where" : "which"
  return spawnSync(probe, [cmd], { stdio: "ignore" }).status === 0
}

function claudeSettingsPath() {
  const base = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude")
  return join(base, "settings.json")
}

// Adds the CodingSchool MCP tools to Claude Code's permissions.allow, keeping a
// backup of the previous file. Returns "added" | "present" | "invalid".
function allowClaudeTools(settingsPath) {
  let settings = {}
  if (existsSync(settingsPath)) {
    settings = readJson(settingsPath)
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return "invalid"
  }
  const allow = settings.permissions?.allow ?? []
  if (allow.includes(CLAUDE_TOOL_PERMISSION)) return "present"
  if (existsSync(settingsPath)) copyFileSync(settingsPath, settingsPath + ".bak")
  settings.permissions = { ...settings.permissions, allow: [...allow, CLAUDE_TOOL_PERMISSION] }
  writeJson(settingsPath, settings)
  return "added"
}

async function setupClaudeCode() {
  console.log("  Claude Code — install the plugin from inside Claude Code:\n")
  console.log(`    /plugin marketplace add ${MARKETPLACE}`)
  console.log("    /plugin install codingschool@codingskuy\n")
  console.log("  Then start a persona:\n")
  console.log("    claude --agent codingschool:teacher")
  console.log("    claude --agent codingschool:coach\n")

  const settingsPath = claudeSettingsPath()
  console.log("  Claude Code asks before each new MCP tool. CodingSchool can be allowed once:")
  console.log(`    ${CLAUDE_TOOL_PERMISSION} → ${settingsPath}\n`)
  if (!(await confirm("Allow the CodingSchool tools in your Claude Code settings?"))) {
    console.log("  Skipped. Claude Code will ask the first time each tool is used.\n")
    return
  }
  const result = allowClaudeTools(settingsPath)
  if (result === "invalid") {
    console.log(`  ✗ ${settingsPath} is not valid JSON — left unchanged. Add "${CLAUDE_TOOL_PERMISSION}" to permissions.allow yourself.\n`)
  } else if (result === "present") {
    console.log("  ✓ Already allowed.\n")
  } else {
    console.log(`  ✓ Allowed (previous file saved as ${settingsPath}.bak).\n`)
  }
}

async function setupPi() {
  const command = ["install", `npm:${PACKAGE_NAME}`]
  if (!hasCommand("pi")) {
    console.log("  Pi is not on your PATH. Install the package from Pi with:\n")
    console.log(`    pi ${command.join(" ")}\n`)
  } else if (await confirm(`Run "pi ${command.join(" ")}" now?`)) {
    const result = spawnSync("pi", command, { stdio: "inherit" })
    if (result.status !== 0) {
      console.log(`\n  ✗ pi exited with code ${result.status}. Run it yourself: pi ${command.join(" ")}\n`)
      return
    }
    console.log("\n  ✓ Installed.\n")
  } else {
    console.log(`  Skipped. Run it yourself: pi ${command.join(" ")}\n`)
  }
  console.log("  In Pi: /teacher, /coach, /codingschool off — or start with: pi --codingschool teacher\n")
}

function mcpServerSnippet(platformId) {
  return JSON.stringify({
    mcpServers: {
      codingschool: { command: "npx", args: ["-y", PACKAGE_NAME, "mcp", "--platform", platformId] },
    },
  }, null, 2)
}

function printGateHook() {
  console.log("  Claim gate: if the host runs pre-tool hooks (exit 2 = deny), add this command")
  console.log("  for file-writing tools so Coach can write only while a claim is open:\n")
  console.log(`    npx -y ${PACKAGE_NAME} gate-check\n`)
  console.log("  Without hooks the gate is prompt-only: the personas are told the rule, but")
  console.log("  the host does not enforce it.\n")
}

async function setupDsh() {
  console.log("  DeepSeek Harness (developer preview — best effort).\n")
  console.log("  Teacher and Coach become agent presets, available in DSH Web (dsh web).")
  console.log("  DSH Desktop, headless and the SDK/ACP modes have no presets yet.\n")

  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh")
  const dir = join(dshHome, "codingschool")
  const { writeCodingSchoolDshFiles, DSH_HOOKS_PACKAGE } = await import(new URL("../dist/dsh-setup.js", import.meta.url).href)

  if (!(await confirm(`Write the CodingSchool presets to ${dir}?`))) {
    console.log("  Skipped. Re-run with --yes to write them.\n")
    return
  }
  const patchPath = writeCodingSchoolDshFiles(dir)
  console.log(`  ✓ Wrote ${patchPath}\n`)
  console.log("  1. Install DSH's Claude Code hook bridge (enforces Coach's claim gate):\n")
  console.log(`       dsh plugin --profile web add ${DSH_HOOKS_PACKAGE}@<your dsh version>\n`)
  console.log("  2. Start DSH Web with the presets:\n")
  console.log(`       dsh web --patch "${patchPath}"\n`)
  console.log('  3. On a new session, pick "Teacher" or "Coach" in the mode picker.')
  console.log("     DSH can't change the preset after a session starts, so the Teacher → Coach")
  console.log("     handoff means starting a new session with the Coach preset.\n")
}

function setupMcp() {
  console.log("  Any MCP host — add this server to the host's MCP configuration:\n")
  console.log(mcpServerSnippet("mcp").replace(/^/gm, "    ") + "\n")
  console.log('  Personas are available as the MCP prompts "teacher" and "coach".\n')
  printGateHook()
}

async function runPlatformSetup(platformId) {
  console.log(BANNER)
  if (platformId === "claude-code") return setupClaudeCode()
  if (platformId === "pi") return setupPi()
  if (platformId === "dsh") return setupDsh()
  return setupMcp()
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const subcommand = process.argv[2] || "setup"

  switch (subcommand) {
    case "setup": {
      const platformId = flagValue("--platform") ?? "opencode"
      if (!PLATFORMS.includes(platformId)) {
        console.log(`  Unknown platform: ${platformId}\n  Use one of: ${PLATFORMS.join(", ")}`)
        process.exit(1)
      }
      if (platformId === "opencode") await runSetup()
      else await runPlatformSetup(platformId)
      break
    }
    case "gate-check":
      // Called by host pre-tool hooks; keep argv as if dist/gate-check.js ran directly.
      process.argv.splice(2, 1)
      await import(new URL("../dist/gate-check.js", import.meta.url).href)
      break
    case "mcp":
      // stdio MCP server; stdout belongs to the protocol, so print nothing here.
      process.argv.splice(2, 1)
      await import(new URL("../dist/mcp.js", import.meta.url).href)
      break
    case "--help":
    case "help":
      console.log(`
  Usage:
    npx @codingskuy/coding-school setup          Interactive setup (default: global scope)
    npx @codingskuy/coding-school setup --project Register only in the current project
    npx @codingskuy/coding-school setup --global  Force global scope
    npx @codingskuy/coding-school setup --platform <p>
        Set up another host: claude-code | pi | dsh | mcp  (default: opencode)
        [--yes] accept every prompt (non-interactive)
    npx @codingskuy/coding-school gate-check      Claim-gate check for pre-tool hooks
                                                  (reads hook JSON on stdin; exit 0 allow, 2 deny)
        [--project-dir <dir>] [--format exit-code|json]
    npx @codingskuy/coding-school mcp             Run the MCP server (stdio) with all cs_* tools
        [--project-dir <dir>] [--platform claude-code|pi|dsh|mcp]
    npx @codingskuy/coding-school help            Show this help
      `)
      break
    default:
      console.log(`  Unknown command: ${subcommand}\n  Run "npx @codingskuy/coding-school help" for usage.`)
      process.exit(1)
  }
}

main().catch(err => {
  console.error(`\n  ✗ Error: ${err.message}\n`)
  process.exit(1)
})
