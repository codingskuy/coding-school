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
