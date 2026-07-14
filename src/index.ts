import { type Plugin, type PluginModule, tool } from "@opencode-ai/plugin"
import { join } from "path"

import {
  createCoachContext,
  handleGreeting,
  handleLearnTopic,
  handleQuestionRoadmap,
  handlePrerequisiteQuestion,
  handleAchievement,
  handleResume,
  handleStatusCheck,
  processCoachingChoice,
} from "./coach"
import { detectIntent, onboardingMessage, choicePrompt } from "./utils/templates"
import { createRoadmap } from "./roadmap/generator"
import { getProgress, updateProgress, renderDashboard } from "./progress/tracker"
import { assessQuiz, renderAssessment, saveAssessment } from "./assessment/engine"
import { resumeSession, createOrUpdateSession, getLatestSessionInfo } from "./session/resume"
import { isProfileExists } from "./utils/paths"
import { ensureDir, readJson, writeJson } from "./utils/fs"
import { progressPath } from "./utils/paths"
import type { ProgressData } from "./utils/types"

function extractTopic(message: string): string {
  const lower = message.toLowerCase()
  const patterns = [
    /(?:learn|study|about|want to learn|wanna learn)\s+(\w+(?:\s+\w+)?)/i,
    /(?:how (?:to|do|does|can)|what is|explain)\s+(\w+(?:\s+\w+)?)/i,
    /(?:teach me|tell me about)\s+(\w+(?:\s+\w+)?)/i,
  ]
  for (const p of patterns) {
    const m = message.match(p)
    if (m) return m[1]
  }
  return message.split(/\s+/).slice(0, 3).join(" ")
}

function extractLevelChoice(message: string): "beginner" | "intermediate" | "expert" {
  const lower = message.toLowerCase()
  if (/\b(beginner|easy|basic|newbie)\b/.test(lower)) return "beginner"
  if (/\b(intermediate|medium)\b/.test(lower)) return "intermediate"
  if (/\b(expert|advanced|hard|pro)\b/.test(lower)) return "expert"
  return "beginner"
}

const CodingSchoolPlugin: Plugin = async ({ directory }) => {
  const projectDir = directory || "."

  return {
    tool: {
      cs_coach_dialog: tool({
        description: "Start a dialog with the CodingSchool coach. Call when the user wants to learn or needs guidance.",
        args: {
          message: tool.schema.string(),
          choice: tool.schema.string().optional(),
        },
        async execute(args) {
          const ctx = createCoachContext(projectDir)

          if (args.choice) {
            const result = processCoachingChoice(args.choice as "A" | "B")
            return result.message
          }

          if (!args.message) {
            if (!isProfileExists(projectDir)) {
              return onboardingMessage()
            }
            const greeting = handleGreeting(ctx)
            return greeting.message || "How can I help you learn today?"
          }

          const intent = detectIntent(args.message)
          const topic = extractTopic(args.message)

          switch (intent) {
            case "greeting": {
              if (!isProfileExists(projectDir)) {
                return onboardingMessage()
              }
              const greeting = handleGreeting(ctx)
              return greeting.message || "How can I help you learn today?"
            }
            case "learn-topic":
              return handleLearnTopic(topic).message
            case "question-roadmap":
              return handleQuestionRoadmap(projectDir, topic, args.message).message
            case "question-prerequisite":
              return handlePrerequisiteQuestion(projectDir, topic).message
            case "achievement":
              return handleAchievement(topic).message
            case "resume":
              return handleResume(projectDir).message
            case "status-check":
              return handleStatusCheck(projectDir).message
            case "complete-task":
              return processCoachingChoice("A").message
            case "unknown":
            default:
              return `I'm here to help you learn. Tell me what you'd like to study, or ask me about your progress.\n\n${onboardingMessage()}`
          }
        },
      }),

      cs_create_roadmap: tool({
        description: "Create a new learning roadmap for a specific topic. Creates a learning contract in .codingschool/roadmap/",
        args: {
          topic: tool.schema.string(),
          level: tool.schema.enum(["beginner", "intermediate", "expert"]),
        },
        async execute(args) {
          if (!args.topic || args.topic.trim().length === 0) {
            return "Please specify a topic to learn."
          }
          const path = createRoadmap({
            projectDir,
            topic: args.topic,
            level: args.level,
          })
          return `Learning plan created at \`${path}\`\n\n${choicePrompt()}`
        },
      }),

      cs_update_progress: tool({
        description: "Update the user's learning progress. Mark items as completed in the roadmap.",
        args: {
          topic: tool.schema.string(),
          item: tool.schema.string(),
          status: tool.schema.enum(["done", "skipped", "in-progress"]),
        },
        async execute(args) {
          if (!args.topic || !args.item) {
            return "Both topic and item are required."
          }
          const progress = updateProgress({
            projectDir,
            topic: args.topic,
            item: args.item,
            status: args.status,
          })
          return `Progress updated.\n\n${renderDashboard(progress)}`
        },
      }),

      cs_assess_quiz: tool({
        description: "Provide a rubric-based assessment of the user's answers in a quiz or learning session.",
        args: {
          answers: tool.schema.string(),
          topic: tool.schema.string(),
          stage: tool.schema.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
        },
        async execute(args) {
          let answers: Record<string, string> = {}
          try {
            answers = JSON.parse(args.answers)
          } catch {
            answers = { response: args.answers }
          }

          const rubric = assessQuiz({
            answers,
            topic: args.topic,
            stage: args.stage,
          })

          saveAssessment(projectDir, args.topic, rubric)

          return renderAssessment(rubric)
        },
      }),

      cs_resume_session: tool({
        description: "Load the previous learning session. Check .codingschool/sessions/ for the last checkpoint.",
        args: {
          date: tool.schema.string().optional(),
        },
        async execute(args) {
          if (args.date) {
            const result = resumeSession(projectDir)
            if (result.hasSession && result.session) {
              return `Checkpoint session **${result.date}**:
- Topic: ${result.session.topic}
- Level: ${result.session.level}
- Progress: ${result.session.progressPercent}%
- Stage: ${result.session.bloomStage}
- Last activity: ${result.session.lastActivity}

Continue from here?`
            }
            return `No session found for date ${args.date}.`
          }

          const latest = getLatestSessionInfo(projectDir)
          if (latest) {
            return `Last checkpoint: session **${latest.date}**.
- Topic: ${latest.data.topic}
- Progress: ${latest.data.progressPercent}%
- Bloom Stage: ${latest.data.bloomStage}

Continue learning or start a new topic?`
          }

          return "No previous learning sessions found. Start your learning journey now!"
        },
      }),
    },

    config: async (config) => {
      config.agent ??= {}
      config.agent["coding-school"] = {
        description: "Software engineering learning mentor",
        prompt: SYSTEM_PROMPT,
      }
      const perm: Record<string, string> = { question: "allow", "cs_*": "allow" }
      config.agent["coding-school"].permission = perm
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        ensureDir(join(projectDir, ".codingschool", "sessions"))
        ensureDir(join(projectDir, ".codingschool", "roadmap"))
        ensureDir(join(projectDir, ".codingschool", "quizzes"))
        ensureDir(join(projectDir, ".codingschool", "reports"))
        ensureDir(join(projectDir, ".codingschool", "certificates"))
      }
    },

    "permission.ask": async (input, output) => {
      if (input.id === "question") {
        output.status = "allow"
      }
    },
  }
}

const SYSTEM_PROMPT = `You are CodingSchool — a software engineering mentor.

Your job is to teach the user to understand concepts, not just generate code.

AVAILABLE TOOLS:
- cs_coach_dialog: Start a coaching conversation. Call when the user wants to learn or needs guidance.
- cs_create_roadmap: Create a structured learning plan with theory + practice.
- cs_update_progress: Mark items done to track progress and award XP.
- cs_assess_quiz: Evaluate user answers with a 5-dimension rubric.
- cs_resume_session: Resume the last checkpoint.

CRITICAL RULES:
1. When the user needs to make a choice (A/B, level, topic, continue/new), you MUST use the native "question" tool to render interactive buttons. Never output plain-text A/B options.
2. Only call cs_coach_dialog() when the user explicitly mentions learning, asks for a mentor, or expresses intent to study a topic. Do NOT call it for general coding assistance requests.
3. After calling "question", the user's answer appears in the conversation — use it to call the next cs_* tool.
4. You cannot write or edit files — use cs_create_roadmap to create learning plans.
5. DO NOT write code for the user. The user must write their own code. You may only:
   - Write code comments or pseudocode as guidance.
   - Execute READ-ONLY commands: git log, git diff, git status (to review work).
   - Run the user's code to verify output and provide evaluation.
   - Suggest best practices, point out bugs, or recommend refactors — but the user must make the changes.
6. DO NOT execute commands that write new files for the user. The user must create their own project files.`

export default {
  id: "coding-school",
  server: CodingSchoolPlugin,
} satisfies PluginModule
