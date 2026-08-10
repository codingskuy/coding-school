#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { createInterface } from "readline"
import { homedir, platform } from "os"

const PACKAGE_NAME = "@codingskuy/coding-school"
const VERSION = "2.2.0"

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
  piAgent: { label: "PI Agent (coming soon)", selected: false, disabled: true },
}

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

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const subcommand = process.argv[2] || "setup"

  switch (subcommand) {
    case "setup":
      await runSetup()
      break
    case "--help":
    case "help":
      console.log(`
  Usage:
    npx @codingskuy/coding-school setup          Interactive setup (default: global scope)
    npx @codingskuy/coding-school setup --project Register only in the current project
    npx @codingskuy/coding-school setup --global  Force global scope
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
