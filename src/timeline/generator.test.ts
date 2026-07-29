import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { initTimeline, addTimelineItem, updateTimelineItem, listTimeline, scaffoldProject } from "./generator"

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "codingschool-test-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("initTimeline", () => {
  it("creates a timeline JSON file", () => {
    const result = initTimeline({
      projectDir: tmpDir,
      projectName: "Todo App",
      description: "A task management app",
      techStack: ["React", "Node.js", "PostgreSQL"],
      milestones: [{ name: "MVP" }, { name: "Auth" }, { name: "Deploy" }],
    })
    expect(result).toContain("Todo App")
    expect(result).toContain("3 milestone(s)")
    const tlPath = join(tmpDir, ".codingschool", "timeline", "todo-app.json")
    expect(existsSync(tlPath)).toBe(true)
  })

  it("sets all milestones as todo", () => {
    initTimeline({
      projectDir: tmpDir,
      projectName: "Todo App",
      description: "",
      techStack: [],
      milestones: [{ name: "MVP" }, { name: "Auth" }],
    })
    const data = JSON.parse(readFileSync(join(tmpDir, ".codingschool", "timeline", "todo-app.json"), "utf-8"))
    expect(data.milestones[0].status).toBe("todo")
    expect(data.milestones[1].status).toBe("todo")
  })
})

describe("addTimelineItem", () => {
  beforeEach(() => {
    initTimeline({
      projectDir: tmpDir,
      projectName: "Todo App",
      description: "",
      techStack: [],
      milestones: [{ name: "MVP" }],
    })
  })

  it("adds a sprint to a milestone", () => {
    const result = addTimelineItem({
      projectDir: tmpDir,
      projectName: "Todo App",
      type: "sprint",
      name: "Sprint 1",
      parentName: "MVP",
    })
    expect(result).toContain("Sprint 1")
  })

  it("adds an epic to a sprint", () => {
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "sprint", name: "Sprint 1", parentName: "MVP" })
    const result = addTimelineItem({
      projectDir: tmpDir, projectName: "Todo App", type: "epic", name: "Task CRUD", parentName: "Sprint 1",
    })
    expect(result).toContain("Task CRUD")
  })

  it("adds a task to an epic", () => {
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "sprint", name: "Sprint 1", parentName: "MVP" })
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "epic", name: "Task CRUD", parentName: "Sprint 1" })
    const result = addTimelineItem({
      projectDir: tmpDir, projectName: "Todo App", type: "task", name: "Create model", parentName: "Task CRUD",
    })
    expect(result).toContain("Create model")
  })

  it("returns error for missing project", () => {
    const result = addTimelineItem({
      projectDir: tmpDir, projectName: "Nonexistent", type: "sprint", name: "S1", parentName: "MVP",
    })
    expect(result).toContain("not found")
  })

  it("adds a milestone directly to timeline", () => {
    const result = addTimelineItem({
      projectDir: tmpDir, projectName: "Todo App", type: "milestone", name: "Testing",
    })
    expect(result).toContain("Testing")
  })
})

describe("updateTimelineItem", () => {
  beforeEach(() => {
    initTimeline({
      projectDir: tmpDir,
      projectName: "Todo App",
      description: "",
      techStack: [],
      milestones: [{ name: "MVP" }],
    })
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "sprint", name: "Sprint 1", parentName: "MVP" })
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "epic", name: "Task CRUD", parentName: "Sprint 1" })
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "task", name: "Create model", parentName: "Task CRUD" })
  })

  it("marks a milestone as done", () => {
    const result = updateTimelineItem({
      projectDir: tmpDir, projectName: "Todo App", itemName: "MVP", status: "done",
    })
    expect(result).toContain("done")
  })

  it("marks a task as blocked", () => {
    const result = updateTimelineItem({
      projectDir: tmpDir, projectName: "Todo App", itemName: "Create model", status: "blocked",
    })
    expect(result).toContain("blocked")
  })

  it("returns error for unknown item", () => {
    const result = updateTimelineItem({
      projectDir: tmpDir, projectName: "Todo App", itemName: "Ghost", status: "done",
    })
    expect(result).toContain("not found")
  })

  it("returns error for unknown project", () => {
    const result = updateTimelineItem({
      projectDir: tmpDir, projectName: "Ghost", itemName: "MVP", status: "done",
    })
    expect(result).toContain("not found")
  })
})

describe("listTimeline", () => {
  it("renders timeline with milestones and sprints", () => {
    initTimeline({
      projectDir: tmpDir,
      projectName: "Todo App",
      description: "A task manager",
      techStack: ["React", "Node"],
      milestones: [{ name: "MVP" }, { name: "Auth" }],
    })
    addTimelineItem({ projectDir: tmpDir, projectName: "Todo App", type: "sprint", name: "Sprint 1", parentName: "MVP" })
    updateTimelineItem({ projectDir: tmpDir, projectName: "Todo App", itemName: "MVP", status: "done" })

    const output = listTimeline(tmpDir, "Todo App")
    expect(output).toContain("Todo App")
    expect(output).toContain("A task manager")
    expect(output).toContain("React")
    expect(output).toContain("MVP")
    expect(output).toContain("Auth")
    expect(output).toContain("Sprint 1")
  })

  it("returns not found for missing project", () => {
    const output = listTimeline(tmpDir, "Ghost")
    expect(output).toContain("No timeline found")
  })
})

describe("scaffoldProject", () => {
  it("creates folder structure from JSON", () => {
    const structure = {
      src: {
        components: ["Header.tsx", "Footer.tsx"],
        pages: ["index.tsx"],
      },
      public: ["favicon.ico"],
      "package.json": null,
    }
    const result = scaffoldProject({
      projectDir: tmpDir,
      projectName: "my-app",
      structure,
    })
    expect(result).toContain("my-app")
    expect(existsSync(join(tmpDir, "my-app", "src", "components", "Header.tsx"))).toBe(true)
    expect(existsSync(join(tmpDir, "my-app", "src", "components", "Footer.tsx"))).toBe(true)
    expect(existsSync(join(tmpDir, "my-app", "public", "favicon.ico"))).toBe(true)
  })

  it("returns error if directory already exists", () => {
    const { mkdirSync } = require("fs")
    mkdirSync(join(tmpDir, "my-app"))
    const result = scaffoldProject({
      projectDir: tmpDir,
      projectName: "my-app",
      structure: {},
    })
    expect(result).toContain("already exists")
  })
})
