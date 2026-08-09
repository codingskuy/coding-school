import { readJson, writeJson } from "./utils/fs"
import { workflowPath } from "./utils/paths"

export interface TeacherWorkflowState {
  diagnosedTopics: string[]
  roadmapTopics: string[]
  taughtTopics: string[]
  assessedTopics: string[]
}

export interface CoachWorkflowState {
  timelineInit: boolean
  claimItems: Record<string, "open" | "closed">
}

export interface WorkflowState {
  teacher: TeacherWorkflowState
  coach: CoachWorkflowState
  lastTool: string
  updatedAt: string
}

export function defaultWorkflow(): WorkflowState {
  return {
    teacher: {
      diagnosedTopics: [],
      roadmapTopics: [],
      taughtTopics: [],
      assessedTopics: [],
    },
    coach: {
      timelineInit: false,
      claimItems: {},
    },
    lastTool: "",
    updatedAt: new Date().toISOString(),
  }
}

export function loadWorkflow(projectDir: string): WorkflowState {
  return readJson<WorkflowState>(workflowPath(projectDir), defaultWorkflow())
}

export function saveWorkflow(projectDir: string, state: WorkflowState): void {
  state.updatedAt = new Date().toISOString()
  writeJson(workflowPath(projectDir), state)
}

function pushUnique(list: string[], value: string): string[] {
  if (!value || list.includes(value)) return list
  return [...list, value]
}

export interface RecordToolInput {
  toolName: string
  topic?: string
  item?: string
  projectName?: string
  verdict?: string
}

/**
 * Record a tool call so later calls can be checked for ordering.
 * Advisory only — never throws.
 */
export function recordTool(projectDir: string, input: RecordToolInput): void {
  const state = loadWorkflow(projectDir)
  state.lastTool = input.toolName

  switch (input.toolName) {
    case "cs_diagnose_student":
      if (input.topic) state.teacher.diagnosedTopics = pushUnique(state.teacher.diagnosedTopics, input.topic)
      break
    case "cs_create_roadmap":
      if (input.topic) state.teacher.roadmapTopics = pushUnique(state.teacher.roadmapTopics, input.topic)
      break
    case "cs_teach_concept":
      if (input.topic) state.teacher.taughtTopics = pushUnique(state.teacher.taughtTopics, input.topic)
      break
    case "cs_assess_quiz":
      if (input.topic) state.teacher.assessedTopics = pushUnique(state.teacher.assessedTopics, input.topic)
      break
    case "cs_timeline_init":
      state.coach.timelineInit = true
      break
    case "cs_claim_open":
      if (input.item) state.coach.claimItems[input.item] = "open"
      break
    case "cs_claim_submit":
      if (input.item && input.verdict !== "partial-pass-continue") state.coach.claimItems[input.item] = "closed"
      break
  }

  saveWorkflow(projectDir, state)
}

export interface CheckOptions {
  toolName: string
  topic?: string
  item?: string
}

/**
 * Advisory workflow checks. Each returns an optional warning string that
 * should be prepended to the tool output so the agent can self-correct —
 * they never block a legitimate call.
 */
export function checkAdvisories(projectDir: string, options: CheckOptions): string[] {
  const { toolName, topic, item } = options
  const state = loadWorkflow(projectDir)
  const warnings: string[] = []

  switch (toolName) {
    case "cs_teach_concept": {
      if (topic && !state.teacher.diagnosedTopics.includes(topic)) {
        warnings.push(
          `Workflow: topic "${topic}" has not been diagnosed yet (cs_diagnose_student). Consider diagnosing first so the starting hint level matches the student.`,
        )
      }
      break
    }
    case "cs_update_progress": {
      if (topic && !state.teacher.diagnosedTopics.includes(topic) && !state.teacher.roadmapTopics.includes(topic)) {
        warnings.push(
          `Workflow: no diagnosis or roadmap found for "${topic}". Progress may not match the student's actual level.`,
        )
      }
      break
    }
    case "cs_update_competency": {
      if (topic && !state.teacher.taughtTopics.includes(topic)) {
        warnings.push(
          `Workflow: competency for "${topic}" is being updated before any cs_teach_concept call. Base scores on observed behavior where possible.`,
        )
      }
      break
    }
    case "cs_claim_submit": {
      const claimItem = item ?? topic
      if (claimItem) {
        const claimState = state.coach.claimItems[claimItem]
        if (!claimState) {
          warnings.push(
            `Workflow: no open claim recorded for item "${claimItem}" (cs_claim_open). Verify a claim exists before submitting a verdict.`,
          )
        }
      }
      break
    }
  }

  return warnings
}

/** Convenience: true when a roadmap exists for the topic (created or progressed). */
export function hasRoadmap(projectDir: string, topic: string): boolean {
  const state = loadWorkflow(projectDir)
  return (
    state.teacher.roadmapTopics.includes(topic) ||
    state.teacher.diagnosedTopics.includes(topic)
  )
}
