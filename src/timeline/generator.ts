import { ensureDir, readJson, writeJson } from "../utils/fs"
import { timelineDir, timelinePath } from "../utils/paths"
import type { TimelineData, Milestone, Sprint, Epic, Task, TimelineStatus, TimelineItemType } from "../utils/types"
import { join } from "path"
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs"

export interface InitTimelineOptions {
  projectDir: string
  projectName: string
  description: string
  techStack: string[]
  milestones: Array<{ name: string }>
}

export function initTimeline(options: InitTimelineOptions): string {
  const { projectDir, projectName, description, techStack } = options
  ensureDir(timelineDir(projectDir))

  const now = new Date().toISOString()
  const data: TimelineData = {
    projectName,
    description,
    techStack,
    milestones: options.milestones.map(m => ({
      name: m.name,
      status: "todo" as TimelineStatus,
      sprints: [],
    })),
    createdAt: now,
    updatedAt: now,
  }

  writeJson(timelinePath(projectDir, projectName), data)
  return `Project "${projectName}" initialized with ${data.milestones.length} milestone(s).`
}

export function loadTimeline(projectDir: string, projectName: string): TimelineData | null {
  return readJson<TimelineData | null>(timelinePath(projectDir, projectName), null)
}

function saveTimeline(projectDir: string, data: TimelineData): void {
  data.updatedAt = new Date().toISOString()
  writeJson(timelinePath(projectDir, data.projectName), data)
}

export interface AddTimelineItemOptions {
  projectDir: string
  projectName: string
  type: TimelineItemType
  name: string
  parentName?: string
  notes?: string
}

export function addTimelineItem(options: AddTimelineItemOptions): string {
  const { projectDir, projectName, type, name, parentName, notes } = options
  const data = loadTimeline(projectDir, projectName)
  if (!data) return `Project "${projectName}" not found. Initialize it first with cs_timeline_init.`

  if (type === "milestone") {
    data.milestones.push({ name, status: "todo", sprints: [] })
    saveTimeline(projectDir, data)
    return `Milestone "${name}" added.`
  }

  if (!parentName) return `parentName required for adding a ${type}.`

  const milestone = findItem(data, parentName, "milestone")
  const sprint = findItem(data, parentName, "sprint")
  const epic = findItem(data, parentName, "epic")

  switch (type) {
    case "sprint": {
      if (!milestone) return `Milestone "${parentName}" not found.`
      milestone.sprints.push({ name, status: "todo", epics: [] })
      saveTimeline(projectDir, data)
      return `Sprint "${name}" added to milestone "${parentName}".`
    }
    case "epic": {
      if (!sprint) return `Sprint "${parentName}" not found.`
      sprint.epics.push({ name, status: "todo", tasks: [] })
      saveTimeline(projectDir, data)
      return `Epic "${name}" added to sprint "${parentName}".`
    }
    case "task": {
      if (!epic) return `Epic "${parentName}" not found.`
      epic.tasks.push({ name, status: "todo", notes })
      saveTimeline(projectDir, data)
      return `Task "${name}" added to epic "${parentName}".`
    }
    default:
      return `Unknown type "${type}".`
  }
}

export interface UpdateTimelineItemOptions {
  projectDir: string
  projectName: string
  itemName: string
  status: TimelineStatus
  notes?: string
}

export function updateTimelineItem(options: UpdateTimelineItemOptions): string {
  const { projectDir, projectName, itemName, status, notes } = options
  const data = loadTimeline(projectDir, projectName)
  if (!data) return `Project "${projectName}" not found.`

  const found = findItemAny(data, itemName)
  if (!found) return `Item "${itemName}" not found in project "${projectName}".`

  found.item.status = status
  if (notes && "notes" in found.item) {
    found.item.notes = notes
  }
  saveTimeline(projectDir, data)

  if (status === "done") {
    const total = countItems(data)
    const done = countItemsByStatus(data, "done")
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return `"${itemName}" marked as ${status}. Overall progress: ${done}/${total} (${pct}%).`
  }

  return `"${itemName}" marked as ${status}.`
}

function findItem(data: TimelineData, name: string, type: TimelineItemType): any {
  if (type === "milestone") {
    return data.milestones.find(m => m.name === name)
  }
  for (const m of data.milestones) {
    if (type === "sprint") {
      const s = m.sprints.find(s => s.name === name)
      if (s) return s
    }
    for (const s of m.sprints) {
      if (type === "epic") {
        const e = s.epics.find(e => e.name === name)
        if (e) return e
      }
      for (const e of s.epics) {
        if (type === "task") {
          const t = e.tasks.find(t => t.name === name)
          if (t) return t
        }
      }
    }
  }
  return null
}

interface FoundItem {
  item: any
  type: TimelineItemType
}

function findItemAny(data: TimelineData, name: string): FoundItem | null {
  for (const m of data.milestones) {
    if (m.name === name) return { item: m, type: "milestone" }
    for (const s of m.sprints) {
      if (s.name === name) return { item: s, type: "sprint" }
      for (const e of s.epics) {
        if (e.name === name) return { item: e, type: "epic" }
        for (const t of e.tasks) {
          if (t.name === name) return { item: t, type: "task" }
        }
      }
    }
  }
  return null
}

export function listTimeline(projectDir: string, projectName: string): string {
  const data = loadTimeline(projectDir, projectName)
  if (!data) return `No timeline found for project "${projectName}".`

  const lines: string[] = []
  lines.push(`# ${data.projectName}`)
  lines.push(`> ${data.description}`)
  lines.push(`> Tech Stack: ${data.techStack.join(", ")}`)
  lines.push("")

  for (const m of data.milestones) {
    const ms = statusIcon(m.status)
    lines.push(`## ${ms} ${m.name}`)
    for (const s of m.sprints) {
      const ss = statusIcon(s.status)
      lines.push(`  ${ss} **${s.name}**`)
      for (const e of s.epics) {
        const es = statusIcon(e.status)
        lines.push(`    ${es} ${e.name}`)
        for (const t of e.tasks) {
          const ts = statusIcon(t.status)
          const note = t.notes ? ` — ${t.notes}` : ""
          lines.push(`      ${ts} ${t.name}${note}`)
        }
      }
    }
  }

  const total = countItems(data)
  const done = countItemsByStatus(data, "done")
  const blocked = countItemsByStatus(data, "blocked")
  const active = countItemsByStatus(data, "in-progress")
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  lines.push("")
  lines.push(`---\n**Progress:** ${done}/${total} (${pct}%) | ✅ Done: ${done} | 🔄 Active: ${active} | 🚫 Blocked: ${blocked}`)

  return lines.join("\n")
}

function statusIcon(status: TimelineStatus): string {
  switch (status) {
    case "done": return "✅"
    case "in-progress": return "🔄"
    case "blocked": return "🚫"
    case "todo": return "⬜"
  }
}

function countItems(data: TimelineData): number {
  let count = 0
  for (const m of data.milestones) {
    count++
    for (const s of m.sprints) {
      count++
      for (const e of s.epics) {
        count++
        count += e.tasks.length
      }
    }
  }
  return count
}

function countItemsByStatus(data: TimelineData, status: TimelineStatus): number {
  let count = 0
  for (const m of data.milestones) {
    if (m.status === status) count++
    for (const s of m.sprints) {
      if (s.status === status) count++
      for (const e of s.epics) {
        if (e.status === status) count++
        for (const t of e.tasks) {
          if (t.status === status) count++
        }
      }
    }
  }
  return count
}

export interface ScaffoldOptions {
  projectDir: string
  projectName: string
  structure: Record<string, any>
}

export function scaffoldProject(options: ScaffoldOptions): string {
  const { projectDir, projectName, structure } = options
  const base = join(projectDir, projectName)

  if (existsSync(base)) return `Directory "${projectName}" already exists. Choose a different name.`

  const created: string[] = []
  createStructure(base, structure, created)

  return `Project scaffolded at \`${base}\`:\n${created.map(p => `- ${p}`).join("\n")}`
}

function createStructure(base: string, structure: Record<string, any>, created: string[]): void {
  for (const [name, children] of Object.entries(structure)) {
    const path = join(base, name)
    if (children === null || typeof children !== "object") {
      mkdirSync(path, { recursive: true })
      created.push(path.replace(base + "/", ""))
    } else if (Array.isArray(children)) {
      mkdirSync(path, { recursive: true })
      created.push(path.replace(base + "/", ""))
      for (const file of children) {
        const filePath = join(path, file)
        writeFileSync(filePath, "", "utf-8")
        created.push(filePath.replace(base + "/", ""))
      }
    } else if (typeof children === "object" && !Array.isArray(children)) {
      mkdirSync(path, { recursive: true })
      created.push(path.replace(base + "/", ""))
      createStructure(path, children as Record<string, any>, created)
    }
  }
}

export function listProjects(projectDir: string): string[] {
  const dir = timelineDir(projectDir)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => f.replace(/\.json$/, ""))
}
