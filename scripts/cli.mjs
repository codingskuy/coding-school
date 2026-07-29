#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname, basename } from "path"
import { createInterface } from "readline"
import { homedir } from "os"

const PACKAGE_NAME = "@codingskuy/coding-school"
const VERSION = "2.1.1"

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
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    for (const name of ["opencode.json", "opencode.jsonc"]) {
      const p = join(dir, name)
      if (existsSync(p)) return p
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

function detectScope() {
  const forceGlobal = process.argv.includes("--global")
  const forceProject = process.argv.includes("--project")

  if (forceGlobal) return { scope: "global", root: homedir() }
  if (forceProject) {
    const root = process.env.INIT_CWD || process.cwd()
    return { scope: "project", root }
  }

  // Auto-detect
  const cwd = process.env.INIT_CWD || process.cwd()
  const hasPackageJson = existsSync(join(cwd, "package.json"))

  if (hasPackageJson) {
    return { scope: "project", root: cwd }
  }

  return { scope: "global", root: homedir() }
}

function getConfigPath(scope, root) {
  if (scope === "global") {
    return join(homedir(), ".config", "opencode", "opencode.json")
  }
  // For project scope, look for existing opencode.json
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

  // 2. Detect scope
  console.log("  Detecting scope...\n")
  const { scope, root } = detectScope()
  console.log(`  → Scope: ${scope}`)
  console.log(`  → Root: ${root}`)
  console.log()

  // 3. Find/config opencode.json
  const configPath = getConfigPath(scope, root)
  console.log(`  → Config: ${configPath}`)
  console.log()

  let existing = readJson(configPath)

  if (existing) {
    if (hasPluginEntry(existing)) {
      console.log("  ✓ CodingSchool already registered in plugin[].\n")
      console.log('  Restart opencode (or run "opencode reload") to apply.\n')
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
    console.log(`  ✓ Created ${scope === "global" ? "global" : "project"} opencode.json with CodingSchool\n`)
  }

  // 4. Check if opencode is installed
  console.log("  ─────────────────────────────────────────────\n")
  console.log("  ✅ Setup complete!\n")
  console.log("  Next step: restart opencode to apply changes.\n")

  if (scope === "global") {
    console.log("  Tip: For project-level config, run from your project directory:\n")
    console.log("       npx @codingskuy/coding-school setup\n")
  }
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
    npx @codingskuy/coding-school setup          Interactive setup (default)
    npx @codingskuy/coding-school setup --project Force project scope
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
