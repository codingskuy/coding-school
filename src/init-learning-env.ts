import { execSync } from "child_process"
import { existsSync, mkdirSync } from "fs"
import { join } from "path"
import { writeJson } from "./utils/fs"
import { codingschoolDir } from "./utils/paths"

export interface InitResult {
  success: boolean
  folderPath: string
  gitInitialized: boolean
  message: string
}

export function initLearningEnv(projectDir: string, topic: string, folderName: string): InitResult {
  const folderPath = join(projectDir, folderName)

  if (existsSync(folderPath)) {
    return {
      success: false,
      folderPath,
      gitInitialized: false,
      message: `Folder "${folderName}" already exists. Please choose a different name.`,
    }
  }

  try {
    mkdirSync(folderPath, { recursive: true })
  } catch (e: any) {
    return {
      success: false,
      folderPath,
      gitInitialized: false,
      message: `Failed to create folder: ${e.message}`,
    }
  }

  let gitInitialized = false
  try {
    execSync("git init", { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
    gitInitialized = true
  } catch {
    gitInitialized = false
  }

  const csDir = codingschoolDir(folderPath)
  try {
    mkdirSync(csDir, { recursive: true })
    writeJson(join(csDir, "context.json"), {
      currentPhase: "learning",
      topic,
      folderName,
      createdAt: new Date().toISOString(),
    })
    writeJson(join(csDir, "progress.json"), {
      topics: {},
      global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 },
      xp: 0,
      level: 1,
    })

    if (gitInitialized) {
      try {
        execSync("git add -A", { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
        execSync(`git commit -m "init: learning environment for ${topic}"`, { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
      } catch { /* initial commit is best-effort */ }
    }
  } catch {
    // Non-fatal: .codingschool setup may partially fail
  }

  const gitMsg = gitInitialized
    ? "Git repository initialized."
    : "Warning: git init failed. You can run 'git init' manually later."

  return {
    success: true,
    folderPath,
    gitInitialized,
    message: `Learning environment ready!\n\n📁 Folder: ${folderName}/\n${gitMsg}\n📂 .codingschool/ structure created.\n\nAll your learning, code, and projects will happen inside this folder.`,
  }
}


export function autoCommit(folderPath: string, message: string): boolean {
  try {
    execSync("git add -A", { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
  } catch {
    return false
  }

  try {
    const diff = execSync("git diff --cached --stat", { cwd: folderPath, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim()
    if (!diff) return false
  } catch {
    return false
  }

  try {
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: folderPath,
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    })
    return true
  } catch {
    return false
  }
}
