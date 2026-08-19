import { execSync } from "child_process"
import { readJson } from "./utils/fs"
import { join } from "path"

// ── Types ──────────────────────────────────────────────────────────────────

export interface SystemReq {
  name: string
  check: string
  install: string
  required: boolean
  versionFlag?: string
}

export interface McpReq {
  name: string
  serverKey: string
  command: string[]
  description: string
  required: boolean
}

export interface TopicRequirement {
  category: string
  system: SystemReq[]
  mcp: McpReq[]
}

export interface ToolCheckResult {
  name: string
  installed: boolean
  version?: string
  error?: string
  required: boolean
}

export interface McpCheckResult {
  name: string
  configured: boolean
  description: string
  serverKey: string
  command: string[]
  required: boolean
}

export interface RequirementReport {
  topic: string
  category: string
  matched: boolean
  system: ToolCheckResult[]
  mcp: McpCheckResult[]
  missingRequired: number
  missingOptional: number
}

// ── Registry ───────────────────────────────────────────────────────────────

const REGISTRY: TopicRequirement[] = [
  {
    category: "mobile",
    system: [
      { name: "Java JDK", check: "which java", install: "brew install openjdk@17", required: true, versionFlag: "-version" },
      { name: "Android SDK", check: "sdkmanager --version", install: "Install Android Studio from developer.android.com", required: true },
    ],
    mcp: [
      {
        name: "MCP Index Debugger",
        serverKey: "mcp-index-debugger",
        command: ["npx", "-y", "@anthropic/mcp-index-debugger"],
        description: "Android device/emulator debugging via ADB",
        required: false,
      },
    ],
  },
  {
    category: "web",
    system: [
      { name: "Node.js", check: "which node", install: "brew install node", required: true, versionFlag: "--version" },
      { name: "npm", check: "which npm", install: "brew install npm", required: true },
    ],
    mcp: [
      {
        name: "Chrome DevTools MCP",
        serverKey: "chrome-dev-tools-mcp",
        command: ["npx", "-y", "@anthropic/chrome-devtools-mcp"],
        description: "Browser inspection, DOM manipulation, console access",
        required: false,
      },
    ],
  },
  {
    category: "uiux",
    system: [],
    mcp: [
      {
        name: "Figma MCP",
        serverKey: "figma-mcp",
        command: ["npx", "-y", "figma-mcp-go"],
        description: "Read Figma designs, inspect components, export assets",
        required: false,
      },
      {
        name: "Chrome DevTools MCP",
        serverKey: "chrome-dev-tools-mcp",
        command: ["npx", "-y", "@anthropic/chrome-devtools-mcp"],
        description: "Browser preview and interaction testing",
        required: false,
      },
    ],
  },
  {
    category: "data-science",
    system: [
      { name: "Python 3", check: "which python3", install: "brew install python3", required: true, versionFlag: "--version" },
      { name: "pip", check: "which pip3", install: "brew install python3 (pip3 included)", required: true },
    ],
    mcp: [],
  },
  {
    category: "devops",
    system: [
      { name: "Docker", check: "which docker", install: "brew install --cask docker", required: true, versionFlag: "--version" },
      { name: "Git", check: "which git", install: "brew install git", required: true, versionFlag: "--version" },
    ],
    mcp: [],
  },
  {
    category: "rust",
    system: [
      { name: "Rust", check: "which rustc", install: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh", required: true, versionFlag: "--version" },
      { name: "Cargo", check: "which cargo", install: "Installed with Rust", required: true },
    ],
    mcp: [],
  },
  {
    category: "go",
    system: [
      { name: "Go", check: "which go", install: "brew install go", required: true, versionFlag: "version" },
    ],
    mcp: [],
  },
]

const TOPIC_KEYWORDS: Record<string, string[]> = {
  mobile: ["android", "kotlin", "java", "ios", "swift", "mobile", "flutter", "react native"],
  web: ["web", "frontend", "backend", "react", "next", "vue", "angular", "node", "express", "html", "css", "javascript", "typescript"],
  uiux: ["ui", "ux", "uiux", "ui/ux", "design", "figma", "prototype", "wireframe"],
  "data-science": ["python", "data", "machine learning", "ml", "ai", "pandas", "numpy", "tensorflow", "analytics"],
  devops: ["devops", "ci/cd", "docker", "kubernetes", "k8s", "terraform", "aws", "cloud"],
  rust: ["rust", "cargo"],
  go: ["go", "golang"],
}

// ── Lookup ─────────────────────────────────────────────────────────────────

export function lookupRequirements(topic: string): TopicRequirement | null {
  const lower = topic.toLowerCase()
  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return REGISTRY.find(r => r.category === category) ?? null
    }
  }
  return null
}

// ── Detection ──────────────────────────────────────────────────────────────

export function checkToolInstalled(check: string, versionFlag?: string): { installed: boolean; version?: string; error?: string } {
  try {
    const result = execSync(check, { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim()
    if (versionFlag) {
      try {
        const base = check.replace(/^(which|command -v)\s+/, "")
        const ver = execSync(`${base} ${versionFlag}`, { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim()
        const firstLine = ver.split("\n")[0]
        return { installed: true, version: firstLine }
      } catch {
        return { installed: true, version: result }
      }
    }
    return { installed: true, version: result || undefined }
  } catch (e: any) {
    return { installed: false, error: e.message?.split("\n")[0] }
  }
}

export function checkMcpConfigured(projectDir: string, serverKey: string): boolean {
  const configPath = join(projectDir, "opencode.json")
  try {
    const config = readJson<Record<string, any>>(configPath, {})
    const mcp = config.mcp
    if (!mcp || typeof mcp !== "object") return false
    const server = mcp[serverKey]
    if (!server) return false
    if (server.enabled === false) return false
    return true
  } catch {
    return false
  }
}

// ── Orchestration ──────────────────────────────────────────────────────────

export function checkRequirements(projectDir: string, topic: string): RequirementReport {
  const req = lookupRequirements(topic)
  if (!req) {
    return {
      topic,
      category: "unknown",
      matched: false,
      system: [],
      mcp: [],
      missingRequired: 0,
      missingOptional: 0,
    }
  }

  const system: ToolCheckResult[] = req.system.map(s => {
    const result = checkToolInstalled(s.check, s.versionFlag)
    return {
      name: s.name,
      installed: result.installed,
      version: result.version,
      error: result.error,
      required: s.required,
    }
  })

  const mcp: McpCheckResult[] = req.mcp.map(m => ({
    name: m.name,
    configured: checkMcpConfigured(projectDir, m.serverKey),
    description: m.description,
    serverKey: m.serverKey,
    command: m.command,
    required: m.required,
  }))

  const missingRequired = system.filter(s => s.required && !s.installed).length + mcp.filter(m => m.required && !m.configured).length
  const missingOptional = system.filter(s => !s.required && !s.installed).length + mcp.filter(m => !m.required && !m.configured).length

  return { topic, category: req.category, matched: true, system, mcp, missingRequired, missingOptional }
}

// ── Report Rendering ───────────────────────────────────────────────────────

export function renderRequirementsReport(report: RequirementReport): string {
  if (!report.matched) {
    return `No built-in requirements found for topic "${report.topic}". This topic may not need special system tools or MCP servers.`
  }

  const lines: string[] = []
  lines.push(`## System Requirements: ${capitalize(report.category)}`)
  lines.push("")

  if (report.system.length > 0) {
    lines.push("### System Tools")
    for (const s of report.system) {
      if (s.installed) {
        lines.push(`- ✅ ${s.name}${s.version ? ` (${s.version})` : ""}`)
      } else {
        const icon = s.required ? "❌" : "⚠️"
        lines.push(`- ${icon} ${s.name} — not found`)
        lines.push(`  → Install: ${getInstallHint(s.name)}`)
      }
    }
    lines.push("")
  }

  if (report.mcp.length > 0) {
    lines.push("### MCP Servers (opencode.json)")
    for (const m of report.mcp) {
      if (m.configured) {
        lines.push(`- ✅ ${m.name} — configured`)
      } else {
        const icon = m.required ? "❌" : "⚠️"
        lines.push(`- ${icon} ${m.name} — not configured`)
        lines.push(`  → ${m.description}`)
        lines.push(`  → Add to opencode.json:\n    "mcp": { "${m.serverKey}": { "type": "local", "command": ${JSON.stringify(m.command)} } }`)
      }
    }
    lines.push("")
  }

  if (report.missingRequired > 0) {
    lines.push(`❌ ${report.missingRequired} required tool(s) missing. Install/configure before continuing.`)
  } else if (report.missingOptional > 0) {
    lines.push(`⚠️ ${report.missingOptional} optional tool(s) missing. You can continue, but installing them improves the experience.`)
  } else {
    lines.push("✅ All requirements met! Ready to go.")
  }

  return lines.join("\n")
}

// ── Helpers ────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getInstallHint(name: string): string {
  const hints: Record<string, string> = {
    "Java JDK": "brew install openjdk@17",
    "Android SDK": "Install Android Studio from developer.android.com",
    "Node.js": "brew install node",
    npm: "brew install npm",
    "Python 3": "brew install python3",
    pip: "brew install python3 (pip3 included)",
    Docker: "brew install --cask docker",
    Git: "brew install git",
    Rust: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
    Cargo: "Installed with Rust",
    Go: "brew install go",
  }
  return hints[name] || `Search for "${name} install" on Google`
}
