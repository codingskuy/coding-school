import { execSync } from "child_process"
import { existsSync, readdirSync } from "fs"
import { join } from "path"

export interface PublishReport {
  action: "check" | "preview" | "publish"
  gitInstalled: boolean
  ghInstalled: boolean
  repoExists: boolean
  repoUrl?: string
  files: string[]
  commits: string[]
  success: boolean
  message: string
}

function checkGitInstalled(): boolean {
  try {
    execSync("which git", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
    return true
  } catch {
    return false
  }
}

function checkGhInstalled(): boolean {
  try {
    execSync("which gh", { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
    return true
  } catch {
    return false
  }
}

function checkRepoExists(folderPath: string): boolean {
  try {
    const remote = execSync("git remote -v", { cwd: folderPath, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim()
    return remote.length > 0
  } catch {
    return false
  }
}

function listHandbookFiles(folderPath: string): string[] {
  const csDir = join(folderPath, ".codingschool")
  if (!existsSync(csDir)) return []

  const files: string[] = []
  try {
    const entries = readdirSync(csDir, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        const rel = join(entry.parentPath ?? entry.path, entry.name).replace(csDir, ".codingschool")
        files.push(rel)
      }
    }
  } catch {
    // fallback: just list handbook dir
    const handbookDir = join(csDir, "handbook")
    if (existsSync(handbookDir)) {
      try {
        const entries = readdirSync(handbookDir)
        for (const e of entries) files.push(`.codingschool/handbook/${e}`)
      } catch { /* skip */ }
    }
  }
  return files
}

function getRecentCommits(folderPath: string, limit: number = 10): string[] {
  try {
    const log = execSync(`git log --oneline -${limit}`, {
      cwd: folderPath,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
    return log ? log.split("\n") : []
  } catch {
    return []
  }
}


export function checkPublishEnv(folderPath: string): PublishReport {
  const gitInstalled = checkGitInstalled()
  const ghInstalled = checkGhInstalled()
  const repoExists = gitInstalled ? checkRepoExists(folderPath) : false
  const files = existsSync(folderPath) ? listHandbookFiles(folderPath) : []
  const commits = gitInstalled ? getRecentCommits(folderPath) : []

  let message = ""
  if (!gitInstalled) {
    message = "Git is not installed. Install it first:\n  macOS: brew install git\n  Linux: sudo apt install git"
  } else if (!repoExists) {
    message = `Ready to publish. ${files.length} file(s) will be included.`
  } else {
    message = "Repository already has a remote. Changes will be pushed to the existing repo."
  }

  return { action: "check", gitInstalled, ghInstalled, repoExists, files, commits, success: true, message }
}


export function previewPublish(folderPath: string): PublishReport {
  const gitInstalled = checkGitInstalled()
  if (!gitInstalled) {
    return { action: "preview", gitInstalled: false, ghInstalled: false, repoExists: false, files: [], commits: [], success: false, message: "Git is not installed." }
  }

  const files = listHandbookFiles(folderPath)
  const commits = getRecentCommits(folderPath)

  if (files.length === 0) {
    return { action: "preview", gitInstalled: true, ghInstalled: checkGhInstalled(), repoExists: checkRepoExists(folderPath), files, commits, success: false, message: "No learning files found in .codingschool/. Start learning first!" }
  }

  const lines: string[] = []
  lines.push("## Files to Publish")
  for (const f of files) lines.push(`  📄 ${f}`)
  lines.push("")
  lines.push(`## Git History (${commits.length} commits)`)
  for (const c of commits) lines.push(`  ${c}`)
  lines.push("")
  lines.push(`Total: ${files.length} file(s), ${commits.length} commit(s)`)

  return { action: "preview", gitInstalled: true, ghInstalled: checkGhInstalled(), repoExists: checkRepoExists(folderPath), files, commits, success: true, message: lines.join("\n") }
}


export function publishToGitHub(folderPath: string, repoName: string, isPrivate: boolean = true): PublishReport {
  const gitInstalled = checkGitInstalled()
  if (!gitInstalled) {
    return { action: "publish", gitInstalled: false, ghInstalled: false, repoExists: false, files: [], commits: [], success: false, message: "Git is not installed." }
  }

  const ghInstalled = checkGhInstalled()
  const repoExists = checkRepoExists(folderPath)

  if (!repoExists) {
    if (ghInstalled) {
      try {
        const visibility = isPrivate ? "--private" : "--public"
        const result = execSync(`gh repo create ${repoName} ${visibility} --source=. --push`, {
          cwd: folderPath,
          encoding: "utf-8",
          timeout: 30000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim()
        const url = result.includes("https://") ? result.match(/https:\/\/[^\s]+/)?.[0] : undefined
        return {
          action: "publish", gitInstalled: true, ghInstalled: true, repoExists: true,
          repoUrl: url, files: listHandbookFiles(folderPath), commits: getRecentCommits(folderPath),
          success: true, message: `Published! ${url ?? repoName}`,
        }
      } catch (e: any) {
        return { action: "publish", gitInstalled: true, ghInstalled: true, repoExists: false, files: [], commits: [], success: false, message: `Failed to create repo: ${e.message?.split("\n")[0]}` }
      }
    } else {
      try {
        execSync("git add -A", { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
        execSync('git commit -m "Initial learning commit"', { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
      } catch { /* best effort */ }
      return {
        action: "publish", gitInstalled: true, ghInstalled: false, repoExists: false,
        files: listHandbookFiles(folderPath), commits: getRecentCommits(folderPath),
        success: false,
        message: `gh CLI not found. Create the repo on GitHub manually, then run:\n  cd ${folderPath}\n  git remote add origin https://github.com/YOUR_USERNAME/${repoName}.git\n  git push -u origin main`,
      }
    }
  }

  try {
    execSync("git add -A", { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
    execSync("git diff --cached --quiet", { cwd: folderPath, encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] })
  } catch {
    // diff --cached --quiet exits 1 when changes exist — try commit
    try {
      execSync('git commit -m "Update learning progress"', { cwd: folderPath, encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] })
    } catch { /* no changes to commit */ }
  }

  try {
    execSync("git push", { cwd: folderPath, encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] })
    return {
      action: "publish", gitInstalled: true, ghInstalled, repoExists: true,
      files: listHandbookFiles(folderPath), commits: getRecentCommits(folderPath),
      success: true, message: "Changes pushed successfully!",
    }
  } catch (e: any) {
    return { action: "publish", gitInstalled: true, ghInstalled, repoExists: true, files: [], commits: [], success: false, message: `Push failed: ${e.message?.split("\n")[0]}` }
  }
}
