import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execSync } from "child_process"

import { checkPublishEnv, previewPublish } from "./publish"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-publish-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function initGitRepo(dir: string) {
  execSync("git init", { cwd: dir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })
  execSync("git config user.email 'test@test.com'", { cwd: dir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })
  execSync("git config user.name 'Test'", { cwd: dir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })
}

describe("checkPublishEnv", () => {
  it("detects git installed", () => {
    const report = checkPublishEnv(tmpDir)
    expect(report.gitInstalled).toBe(true)
  })

  it("detects no repo when fresh dir", () => {
    const report = checkPublishEnv(tmpDir)
    expect(report.repoExists).toBe(false)
  })

  it("detects existing repo with remote", () => {
    initGitRepo(tmpDir)
    execSync("git remote add origin https://github.com/test/test.git", { cwd: tmpDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })
    const report = checkPublishEnv(tmpDir)
    expect(report.repoExists).toBe(true)
  })

  it("lists handbook files when .codingschool exists", () => {
    const csDir = join(tmpDir, ".codingschool", "handbook")
    mkdirSync(csDir, { recursive: true })
    writeFileSync(join(csDir, "react.md"), "# React Notes")
    writeFileSync(join(csDir, "index.md"), "# Index")

    const report = checkPublishEnv(tmpDir)
    expect(report.files.length).toBe(2)
    expect(report.files.some(f => f.includes("react.md"))).toBe(true)
  })
})

describe("previewPublish", () => {
  it("returns empty when no files", () => {
    const report = previewPublish(tmpDir)
    expect(report.success).toBe(false)
    expect(report.message).toContain("No learning files")
  })

  it("lists files and commits when repo exists", () => {
    initGitRepo(tmpDir)
    const csDir = join(tmpDir, ".codingschool", "handbook")
    mkdirSync(csDir, { recursive: true })
    writeFileSync(join(csDir, "react.md"), "# React Notes")
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })

    const report = previewPublish(tmpDir)
    expect(report.success).toBe(true)
    expect(report.files.length).toBe(1)
    expect(report.commits.length).toBeGreaterThanOrEqual(1)
  })
})
