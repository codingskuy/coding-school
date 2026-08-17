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
  handleCodeReview,
  handleArchitectureReview,
  handleGRCScan,
  handleMentoringPlan,
  handleEngineeringStatus,
} from "./coach"
import { openClaim, submitClaim, hasOpenClaim } from "./coach-gate"
import { detectIntent, onboardingMessage, roadmapConfirmPrompt } from "./utils/templates"
import { createRoadmap, listRoadmapItems } from "./roadmap/generator"
import { getProgress, updateProgress, renderDashboard } from "./progress/tracker"
import { assessQuiz, renderAssessment, saveAssessment } from "./assessment/engine"
import { resumeSession, createOrUpdateSession, getLatestSessionInfo } from "./session/resume"
import { isProfileExists } from "./utils/paths"
import { updateChecklistInFile } from "./utils/fs"
import { generateHandbook } from "./handbook/generator"
import { existsSync, readdirSync } from "fs"

import { progressPath } from "./utils/paths"
import { diagnoseStudent, generateDiagnosisQuestions, buildInitialDiagnosisPrompt } from "./diagnosis"
import { getScaffolding, buildScaffoldingPrompt, shouldEscalateHint } from "./scaffolding"
import { announceDiagnosis, getTeachingSignals, getCoachBriefing, announceCapstone, announceProjectComplete } from "./context"
import { recordTool, checkAdvisories } from "./workflow"
import { traceTool } from "./trace"
import { scaffoldingOffset, applyScaffoldingOffset } from "./meta"
import { generateReflectionPrompt, processSessionReflection, extractInsights } from "./reflection"
import { loadStudentModel, saveStudentModel } from "./student-model"
import { updateTopicCompetency, renderTopicCompetency, renderEngineeringCompetency } from "./competency"
import { migrate, isMigrationNeeded } from "./migration"
import { initTimeline, addTimelineItem, updateTimelineItem, listTimeline, scaffoldProject, listProjects } from "./timeline/generator"
import type { ProgressData, StudentModel, BloomStage, TimelineStatus, EngineeringLevel, ComprehensionAnswer } from "./utils/types"
import type { HintLevel } from "./scaffolding"

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

  // Run migration on load if needed
  if (isMigrationNeeded(projectDir)) {
    const result = migrate(projectDir)
    if (result.migrated) {
      console.log(`[CodingSchool] Migrated ${result.topics} topic(s) to v2.0 format.`)
    }
  }

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

          if (args.message.length > 100 || /^##\s/m.test(args.message)) {
            return "Content acknowledged. Present it directly to the user as text."
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
        description: "Create a new learning roadmap for a specific topic. The AI must generate the full roadmap content and pass it in the content argument.",
        args: {
          topic: tool.schema.string(),
          level: tool.schema.enum(["beginner", "intermediate", "expert"]),
          content: tool.schema.string(),
        },
        async execute(args) {
          if (!args.topic || args.topic.trim().length === 0) {
            return "Please specify a topic to learn."
          }
          if (!args.content || args.content.trim().length === 0) {
            return "Please generate the roadmap content first."
          }
          const path = createRoadmap({
            projectDir,
            topic: args.topic,
            level: args.level,
            content: args.content,
          })
          recordTool(projectDir, { toolName: "cs_create_roadmap", topic: args.topic })
          return `Learning plan created at \`${path}\`\n\n${roadmapConfirmPrompt()}`
        },
      }),

      cs_update_progress: tool({
        description: "Update the user's learning progress. Mark items as completed in the roadmap.",
        args: {
          topic: tool.schema.string(),
          item: tool.schema.string(),
          status: tool.schema.enum(["done", "skipped", "in-progress"]),
          notes: tool.schema.string().optional(),
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
          recordTool(projectDir, { toolName: "cs_update_progress", topic: args.topic, item: args.item })
          const warnings = checkAdvisories(projectDir, {
            toolName: "cs_update_progress",
            topic: args.topic,
          })
          if (args.status === "done") {
            const roadmapDir = join(projectDir, ".codingschool", "roadmap", args.topic.toLowerCase())
            if (existsSync(roadmapDir)) {
              const files = readdirSync(roadmapDir).filter(f => f.endsWith(".md"))
              for (const file of files) {
                updateChecklistInFile(join(roadmapDir, file), args.item)
              }
            }
          }
          const notes = args.notes || ""
          const handbook = generateHandbook(projectDir, args.topic, args.item, notes, progress)
          const warningLines = warnings.map(w => `> ⚠️ ${w}`).join("\n")
          const tp = Object.values(progress.topics).find(
            t => t.name.toLowerCase() === args.topic.toLowerCase(),
          )
          const trackerLines = [
            tp?.currentItem ? `Current: ${tp.currentItem}` : null,
            tp?.lastCompletedItem ? `Last completed: ${tp.lastCompletedItem}` : null,
          ].filter(Boolean)
          const tracker = trackerLines.length > 0 ? `\n${trackerLines.join("\n")}` : ""
          return `${warningLines ? warningLines + "\n\n" : ""}Progress updated.\n\n${renderDashboard(progress)}${tracker}\n\nHandbook updated: \`${handbook.topicPath}\``
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
          recordTool(projectDir, { toolName: "cs_assess_quiz", topic: args.topic })

          return renderAssessment(rubric)
        },
      }),

      cs_prepare_capstone: tool({
        description:
          "Hand the roadmap's Final Project (capstone) to the Coach agent. Call when all non-capstone items are done or the student wants to start their capstone. Reads the ## Final Project section from the roadmap and flags it as ready for the Coach agent.",
        args: {
          topic: tool.schema.string(),
        },
        async execute(args) {
          const items = listRoadmapItems(projectDir, args.topic)
          if (items.length === 0) {
            return `No roadmap found for topic "${args.topic}". Create a roadmap first with cs_create_roadmap.`
          }
          const capstone = items.filter(i =>
            ["final project", "capstone", "project"].includes(i.section.toLowerCase()),
          )
          if (capstone.length === 0) {
            return `No "## Final Project" section found in the roadmap for "${args.topic}". Add a Final Project section, then try again.`
          }
          const capItems = capstone.map(i => i.text)
          announceCapstone(projectDir, { topic: args.topic, items: capItems, ready: true })
          recordTool(projectDir, { toolName: "cs_prepare_capstone", topic: args.topic })
          const projectName = capItems[0]
          return `Capstone prepared for the Coach agent.

Project: **${projectName}** (from topic "${args.topic}" roadmap)
Checklist:
${capItems.map(i => `- [ ] ${i}`).join("\n")}

The Coach agent will see this capstone briefing when it starts. Tell the student:
"Bagus sekali! Sekarang pindah ke agent **Coach** (dropdown agent, atau \`opencode --agent coach\`) untuk membangun proyek capstone: **${projectName}**. Coach akan memandu dari perencanaan sampai proyek selesai."
(Do NOT mark Final Project items as done here — Coach completes them.)`
        },
      }),

      cs_resume_session: tool({
        description: "Load the previous learning session. Check .codingschool/sessions/ for the last checkpoint, or .codingschool/progress.json for existing progress.",
        args: {
          date: tool.schema.string().optional(),
        },
        async execute(args) {
          if (args.date) {
            const sessionFile = join(projectDir, ".codingschool", "sessions", `${args.date}.md`)
            if (existsSync(sessionFile)) {
              const result = resumeSession(projectDir)
              return `Checkpoint session **${result.date}**:
- Topic: ${result.session?.topic}
- Level: ${result.session?.level}
- Progress: ${result.session?.progressPercent}%
- Stage: ${result.session?.bloomStage}
- Last activity: ${result.session?.lastActivity}

Continue from here?`
            }
            return `No session found for date ${args.date}.`
          }

          const latest = getLatestSessionInfo(projectDir)
          if (latest) {
            const model = loadStudentModel()
            const struggleLine = model.frequentStruggles.length > 0
              ? `- Frequent struggles: ${model.frequentStruggles.join(", ")}`
              : "- No standout weak topic"
            return `Last checkpoint: session **${latest.date}**.
- Topic: ${latest.data.topic}
- Progress: ${latest.data.progressPercent}%
- Bloom Stage: ${latest.data.bloomStage}
- Learning velocity: ${model.learningVelocity}
${struggleLine}

Continue learning or start a new topic?`
          }

          const progress = getProgress(projectDir)
          const topics = Object.entries(progress.topics)
          if (topics.length > 0) {
            const lines = topics.map(([name, t]) => {
              const current = t.currentItem
              const last = t.lastCompletedItem
              const detail = current
                ? `\n  Current: ${current}${last ? `\n  Last completed: ${last}` : ""}`
                : t.percent === 100
                  ? "\n  ✅ COMPLETED"
                  : ""
              return `- **${name}**: ${t.percent}% complete${detail}`
            })
            const topicKeys = topics.map(([name]) => name)
            return `Found existing progress in progress.json:\n${lines.join("\n")}\n\nXP: ${progress.xp} | Level: ${progress.level}\n\nIMPORTANT: When calling cs_update_progress, use the EXACT topic key: "${topicKeys[0]}"\n\nContinue learning or start a new topic?`
          }

          return "No previous learning sessions found. Start your learning journey now!"
        },
      }),

      cs_list_roadmap_items: tool({
        description: "List all items in a topic's roadmap with their checkbox status. Use this to find the exact item name before calling cs_update_progress.",
        args: {
          topic: tool.schema.string(),
        },
        async execute(args) {
          const items = listRoadmapItems(projectDir, args.topic)
          if (items.length === 0) {
            return `No roadmap found for topic "${args.topic}". Create a roadmap first with cs_create_roadmap.`
          }

          let currentSection = ""
          const lines: string[] = []
          for (const item of items) {
            if (item.section !== currentSection) {
              lines.push(`\n## ${item.section}`)
              currentSection = item.section
            }
            const status = item.checked ? "x" : " "
            lines.push(`- [${status}] ${item.text}`)
          }

          const unchecked = items.filter(i => !i.checked)
          const checked = items.filter(i => i.checked)
          const total = items.length
          const pct = Math.round((checked.length / total) * 100)

          const progress = getProgress(projectDir)
          const tp = Object.values(progress.topics).find(
            t => t.name.toLowerCase() === args.topic.toLowerCase(),
          )
          const currentLine = tp?.currentItem ? `**Current:** ${tp.currentItem}` : ""
          const lastLine = tp?.lastCompletedItem ? `**Last completed:** ${tp.lastCompletedItem}` : ""

          const tracker = [currentLine, lastLine].filter(Boolean).join("\n")
          return `## Roadmap: ${args.topic}\n${lines.join("\n")}\n\n---\nProgress: ${checked.length}/${total} (${pct}%)\n${tracker ? tracker + "\n" : ""}\nIMPORTANT: When calling cs_update_progress, use the EXACT item text shown above (case-insensitive match).`
        },
      }),

      cs_diagnose_student: tool({
        description: "Diagnose a student's current level, knowledge gaps, and misconceptions for a given topic. Call this when starting a new topic or when the student seems lost.",
        args: {
          topic: tool.schema.string(),
          name: tool.schema.string().optional(),
          goal: tool.schema.string().optional(),
          selfAssessment: tool.schema.string().optional(),
          knownConcepts: tool.schema.string().optional(),
          priorExperience: tool.schema.string().optional(),
        },
        async execute(args) {
          return traceTool(projectDir, "teacher", "cs_diagnose_student", args, async () => {
            const responses: Record<string, string> = {}
            if (args.name) responses.name = args.name
            if (args.goal) responses.goal = args.goal
            if (args.selfAssessment) responses.selfAssessment = args.selfAssessment
            if (args.knownConcepts) responses.knownConcepts = args.knownConcepts
            if (args.priorExperience) responses.priorExperience = args.priorExperience

            const hasResponses = Object.keys(responses).length > 0
            const result = diagnoseStudent(args.topic, hasResponses ? responses : undefined)

            recordTool(projectDir, { toolName: "cs_diagnose_student", topic: args.topic })
            announceDiagnosis(projectDir, {
              topic: args.topic,
              misconceptions: result.misconceptions,
            })

            const lines: string[] = []
            lines.push(`## Diagnosis: ${args.topic}`)
            lines.push("")
            if (result.isNew) {
              lines.push("**New student detected** — setting up profile.")
              lines.push("")
            }
            lines.push(`- **Level:** ${result.level}`)
            lines.push(`- **Confidence:** ${result.confidence}%`)
            lines.push(`- **Recommended style:** ${result.recommendedStyle}`)
            if (result.knownTopics.length > 0) {
              lines.push(`- **Known topics:** ${result.knownTopics.join(", ")}`)
            }
            if (result.unknownTopics.length > 0) {
              lines.push(`- **Needs work:** ${result.unknownTopics.join(", ")}`)
            }
            if (result.misconceptions.length > 0) {
              lines.push(`- **Misconceptions:** ${result.misconceptions.join("; ")}`)
            }
            lines.push(`- **Next step:** ${result.nextStep}`)
            lines.push("")
            lines.push(result.greeting)
            return lines.join("\n")
          })
        },
      }),

      cs_teach_concept: tool({
        description: "Provide scaffolding for teaching a concept. Returns hints at the appropriate level based on the student's competency. Call cs_diagnose_student first to determine the starting hint level.",
        args: {
          topic: tool.schema.string(),
          concept: tool.schema.string().optional(),
          studentAnswer: tool.schema.string().optional(),
          hintLevel: tool.schema.number().optional(),
        },
        async execute(args) {
          return traceTool(projectDir, "teacher", "cs_teach_concept", args, async () => {
            const model = loadStudentModel()
            const result = getScaffolding({
              topic: args.topic,
              concept: args.concept,
              studentAnswer: args.studentAnswer,
              studentModel: model,
            })

            const offset = scaffoldingOffset(projectDir, args.topic)
            const effectiveLevel = (args.hintLevel
              ? (args.hintLevel as HintLevel)
              : applyScaffoldingOffset(result.hintLevel, offset)) as HintLevel

            recordTool(projectDir, { toolName: "cs_teach_concept", topic: args.topic })

            const lines: string[] = []
            const warnings = checkAdvisories(projectDir, {
              toolName: "cs_teach_concept",
              topic: args.topic,
            })
            for (const w of warnings) lines.push(`> ⚠️ ${w}`)
            const signals = getTeachingSignals(projectDir)
            if (signals.length > 0) {
              lines.push(`> **Context from Coach:** ${signals.join(" ")}`)
            }
            if (lines.length > 0) lines.push("")
            lines.push(`**Scaffolding — Level ${effectiveLevel}/5: ${result.technique}**`)
            lines.push("")
            lines.push(result.hint)
            lines.push("")
            lines.push(`Next action: ${result.nextAction}`)
            if (offset !== 0) {
              lines.push(
                `*(Meta-learning: hint level ${offset > 0 ? "raised" : "lowered"} ${Math.abs(offset)} level based on the learning history for this topic.)*`,
              )
            }
            if (result.escalateHint) {
              lines.push("")
              lines.push("*Note: Student seems stuck. Consider escalating to the next hint level.*")
            }
            return lines.join("\n")
          })
        },
      }),

      cs_update_competency: tool({
        description: "Update the student's competency scores for a specific topic. Call after teaching, quizzing, or reviewing material.",
        args: {
          topic: tool.schema.string(),
          knowledge: tool.schema.number().optional(),
          implementation: tool.schema.number().optional(),
          debugging: tool.schema.number().optional(),
          teaching: tool.schema.number().optional(),
        },
        async execute(args) {
          const scores = {
            knowledge: args.knowledge ?? 0,
            implementation: args.implementation ?? 0,
            debugging: args.debugging ?? 0,
            teaching: args.teaching ?? 0,
          }
          updateTopicCompetency(projectDir, args.topic, scores)
          recordTool(projectDir, { toolName: "cs_update_competency", topic: args.topic })

          const lines: string[] = []
          const warnings = checkAdvisories(projectDir, {
            toolName: "cs_update_competency",
            topic: args.topic,
          })
          for (const w of warnings) lines.push(`> ⚠️ ${w}`)
          lines.push(`## Competency Updated: ${args.topic}`)
          lines.push("")
          lines.push(renderTopicCompetency(projectDir, args.topic))
          lines.push("")
          lines.push(renderEngineeringCompetency(projectDir))
          return lines.join("\n")
        },
      }),

      cs_reflect: tool({
        description: "Generate a reflection prompt for the student. Use at end of session, after a challenge, or to check for misconceptions.",
        args: {
          topic: tool.schema.string(),
          type: tool.schema.enum(["end-of-session", "after-challenge", "misconception-check", "progress-review"]),
          reflectionText: tool.schema.string().optional(),
          bloomStage: tool.schema.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).optional(),
        },
        async execute(args) {
          return traceTool(projectDir, "teacher", "cs_reflect", args, async () => {
            if (args.reflectionText) {
              const model = loadStudentModel()
              const result = processSessionReflection(args.topic, args.reflectionText, model)

              const lines: string[] = []
              lines.push("## Session Reflection")
              lines.push("")
              lines.push(result.summary)
              lines.push("")
              if (result.insights.length > 0) {
                lines.push("**Insights:**")
                for (const insight of result.insights) {
                  lines.push(`- ${insight}`)
                }
                lines.push("")
              }
              lines.push(result.progressNote)
              lines.push("")
              lines.push("**Next Session Plan:**")
              lines.push(result.nextSessionPlan)
              lines.push("")
              lines.push(result.encouragement)
              return lines.join("\n")
            }

            const prompt = generateReflectionPrompt(
              args.type,
              args.topic,
              args.bloomStage as BloomStage | undefined,
            )

            const lines: string[] = []
            lines.push(`## Reflection: ${args.type}`)
            lines.push("")
            lines.push(prompt.prompt)
            lines.push("")
            lines.push(`*${prompt.followUp}*`)
            lines.push("")
            lines.push("After the student responds, call `cs_reflect` again with `reflectionText` set to their response to process it.")
            return lines.join("\n")
          })
        },
      }),

      cs_code_review: tool({
        description: "Review code for quality, security, and engineering best practices. Updates engineering competency scores automatically.",
        args: {
          code: tool.schema.string(),
          context: tool.schema.string().optional(),
        },
        async execute(args) {
          return traceTool(projectDir, "coach", "cs_code_review", args, async () => {
            const result = handleCodeReview(projectDir, args.code, args.context)
            return result.message
          })
        },
      }),

      cs_architecture_review: tool({
        description: "Assess a system architecture or design for scalability, maintainability, and risks.",
        args: {
          description: tool.schema.string(),
          patterns: tool.schema.string().optional(),
        },
        async execute(args) {
          return traceTool(projectDir, "coach", "cs_architecture_review", args, async () => {
            const result = handleArchitectureReview(projectDir, args.description, args.patterns)
            return result.message
          })
        },
      }),

      cs_grc_scan: tool({
        description: "Scan code for governance, risk, and compliance issues including OWASP Top 10 vulnerabilities.",
        args: {
          code: tool.schema.string(),
          context: tool.schema.string().optional(),
        },
        async execute(args) {
          return traceTool(projectDir, "coach", "cs_grc_scan", args, async () => {
            const result = handleGRCScan(projectDir, args.code, args.context)
            return result.message
          })
        },
      }),

      cs_mentoring_plan: tool({
        description: "Generate a personalized engineering growth plan based on current competency scores.",
        args: {
          topic: tool.schema.string(),
        },
        async execute(args) {
          const result = handleMentoringPlan(projectDir, args.topic)
          return result.message
        },
      }),

      cs_engineering_status: tool({
        description: "Display the student's current engineering competency scores across all 8 dimensions.",
        args: {},
        async execute() {
          const result = handleEngineeringStatus(projectDir)
          return result.message
        },
      }),

      // ════════════════════════════════════════════
      // Timeline Tools — Project Guide
      // ════════════════════════════════════════════

      cs_timeline_init: tool({
        description: "Initialize a new project timeline with milestones. Starts project planning phase.",
        args: {
          projectName: tool.schema.string(),
          description: tool.schema.string(),
          techStack: tool.schema.string(),
          milestones: tool.schema.string(),
        },
        async execute(args) {
          let milestones: Array<{ name: string }> = []
          try {
            milestones = JSON.parse(args.milestones)
          } catch {
            return "milestones must be a JSON array of { name: string } objects."
          }
          const techStack = args.techStack.split(",").map(s => s.trim()).filter(Boolean)
          recordTool(projectDir, { toolName: "cs_timeline_init", projectName: args.projectName })
          return initTimeline({
            projectDir,
            projectName: args.projectName,
            description: args.description,
            techStack,
            milestones,
          })
        },
      }),

      cs_timeline_add: tool({
        description: "Add a milestone, sprint, epic, or task to an existing timeline. For sprints/epics/tasks, provide parentName.",
        args: {
          projectName: tool.schema.string(),
          type: tool.schema.enum(["milestone", "sprint", "epic", "task"]),
          name: tool.schema.string(),
          parentName: tool.schema.string().optional(),
          notes: tool.schema.string().optional(),
        },
        async execute(args) {
          return addTimelineItem({
            projectDir,
            projectName: args.projectName,
            type: args.type,
            name: args.name,
            parentName: args.parentName,
            notes: args.notes,
          })
        },
      }),

      cs_timeline_update: tool({
        description: "Update the status of any timeline item (milestone/sprint/epic/task). Status: todo, in-progress, done, blocked.",
        args: {
          projectName: tool.schema.string(),
          itemName: tool.schema.string(),
          status: tool.schema.enum(["todo", "in-progress", "done", "blocked"]),
          notes: tool.schema.string().optional(),
        },
        async execute(args) {
          return updateTimelineItem({
            projectDir,
            projectName: args.projectName,
            itemName: args.itemName,
            status: args.status as TimelineStatus,
            notes: args.notes,
          })
        },
      }),

      cs_timeline_list: tool({
        description: "Show the full project timeline with milestones, sprints, epics, tasks, and their statuses.",
        args: {
          projectName: tool.schema.string(),
        },
        async execute(args) {
          return listTimeline(projectDir, args.projectName)
        },
      }),

      cs_project_scaffold: tool({
        description: "Generate the project folder structure after user approval. Structure must be a JSON object representing folders and files.",
        args: {
          projectName: tool.schema.string(),
          structure: tool.schema.string(),
        },
        async execute(args) {
          let structure: Record<string, any> = {}
          try {
            structure = JSON.parse(args.structure)
          } catch {
            return "structure must be a valid JSON object."
          }
          return scaffoldProject({
            projectDir,
            projectName: args.projectName,
            structure,
          })
        },
      }),

      cs_announce_project_complete: tool({
        description:
          "Record a finished project so the Teacher agent can close the roadmap (mark the Final Project items done). Call at the end of a project when all milestones are done; pass a summary of what was built.",
        args: {
          projectName: tool.schema.string(),
          topic: tool.schema.string().optional(),
          summary: tool.schema.string(),
        },
        async execute(args) {
          announceProjectComplete(projectDir, {
            projectName: args.projectName,
            topic: args.topic,
            summary: args.summary,
          })
          recordTool(projectDir, { toolName: "cs_announce_project_complete", projectName: args.projectName })
          return `Project completion recorded. The Teacher agent will see it and close the roadmap.

Tell the student:
"Kerja bagus! Proyek **${args.projectName}** sudah selesai. Sekarang pindah kembali ke agent **Teacher** (dropdown agent, atau \`opencode --agent teacher\`) untuk menutup roadmap dan refleksi akhir."`
        },
      }),

      cs_claim_open: tool({
        description: "Open a code claim for Coach's pair-programming model: snapshot the current state of the target files and mark the timeline item as awaiting the user's comprehension proof. Call BEFORE writing any generated code. The generated code only becomes final when the user claims it (cs_claim_submit verdict=pass).",
        args: {
          projectName: tool.schema.string(),
          itemName: tool.schema.string(),
          files: tool.schema.string(),
        },
        async execute(args) {
          let files: string[] = []
          try {
            files = JSON.parse(args.files)
          } catch {
            return "files must be a valid JSON array of file paths."
          }
          if (!Array.isArray(files) || files.some(f => typeof f !== "string")) {
            return "files must be a JSON array of string file paths."
          }
          const result = openClaim({
            projectDir,
            projectName: args.projectName,
            itemName: args.itemName,
            files,
          })
          recordTool(projectDir, { toolName: "cs_claim_open", projectName: args.projectName, item: args.itemName })
          const briefing = getCoachBriefing(projectDir)
          const briefLines = briefing.length > 0
            ? `> **Context from Teacher:** ${briefing.join(" ")}\n\n`
            : ""
          return `${briefLines}${result}`
        },
      }),

      cs_claim_submit: tool({
        description: "Close a code claim with a verdict: 'pass' (user proved understanding — code stays, timeline item → done, engineering competency bumped), 'fail' (attempts++ — re-explain at the next engineering level), 'partial-pass-continue' (code stays, claim stays open, timeline stays in-progress — watch the weak areas), or 'revert' (roll back generated code to its original state, timeline item → todo). Pass `qa` (JSON array of { question, answer, score }) to record multi-turn comprehension evidence.",
        args: {
          projectName: tool.schema.string(),
          itemName: tool.schema.string(),
          verdict: tool.schema.string(),
          level: tool.schema.string().optional(),
          notes: tool.schema.string().optional(),
          qa: tool.schema.string().optional(),
          confidence: tool.schema.number().optional(),
        },
        async execute(args) {
          const { verdict } = args
          if (verdict !== "pass" && verdict !== "fail" && verdict !== "revert" && verdict !== "partial-pass-continue") {
            return 'verdict must be one of: "pass", "fail", "revert", "partial-pass-continue".'
          }
          const level = args.level as EngineeringLevel | undefined
          if (level !== undefined && level !== "junior" && level !== "mid" && level !== "senior") {
            return 'level must be one of: "junior", "mid", "senior".'
          }
          let qa: ComprehensionAnswer[] | undefined
          if (args.qa) {
            try {
              qa = JSON.parse(args.qa)
            } catch {
              return 'qa must be a valid JSON array of { question, answer, score } objects.'
            }
            if (!Array.isArray(qa) || qa.some(q => !q.question || !q.answer || !q.score)) {
              return 'qa must be a JSON array of { question, answer, score } objects.'
            }
          }
          return traceTool(projectDir, "coach", "cs_claim_submit", args, async () => {
            const warnings = checkAdvisories(projectDir, {
              toolName: "cs_claim_submit",
              item: args.itemName,
            })
            const result = await submitClaim({
              projectDir,
              projectName: args.projectName,
              itemName: args.itemName,
              verdict,
              level,
              notes: args.notes,
              qa,
              confidence: args.confidence,
            })
            recordTool(projectDir, {
              toolName: "cs_claim_submit",
              projectName: args.projectName,
              item: args.itemName,
              verdict,
            })
            return `${warnings.length > 0 ? warnings.map(w => `> ⚠️ ${w}`).join("\n") + "\n\n" : ""}${result}`
          })
        },
      }),
    },

    config: async (config) => {
      config.agent ??= {}

      // Teacher agent — diagnosis-first, scaffolded teaching. NEVER writes files.
      config.agent["teacher"] = {
        description: "Software engineering teacher — diagnosis-first, scaffolded teaching, reflection-driven",
        prompt: TEACHER_SYSTEM_PROMPT,
        mode: "primary",
      }
      const permTeacher: Record<string, string> = {
        question: "allow",
        "cs_*": "allow",
        write: "deny",
        edit: "deny",
        strreplace: "deny",
      }
      config.agent["teacher"].permission = permTeacher

      // Coach agent — engineering mentor with GRC. May write files inside the claim gate flow.
      const permCoach: Record<string, string> = {
        question: "allow",
        "cs_*": "allow",
        write: "allow",
        edit: "allow",
        strreplace: "allow",
      }
      config.agent["coach"] = {
        description: "Software engineering project mentor — code review, architecture, GRC awareness, engineering competency",
        prompt: COACH_SYSTEM_PROMPT,
        mode: "primary",
      }
      config.agent["coach"].permission = { ...permCoach }
    },

    event: async () => {
      // no-op — .codingschool/ dirs created lazily by tools
    },

    "permission.ask": async (input, output) => {
      if (input.id === "question") {
        output.status = "allow"
        return
      }
      // Claim-gate enforcement: file writes are allowed ONLY while a
      // comprehension claim is open (cs_claim_open). This turns
      // "cs_claim_open BEFORE writing any code" from a prompt suggestion
      // into a system rule for the pair-programming workflow.
      if (input.id === "write" || input.id === "edit" || input.id === "strreplace") {
        if (!hasOpenClaim(projectDir)) {
          output.status = "deny"
          return
        }
        output.status = "allow"
        return
      }
      // Everything else: defer to the agent permission maps / user.
    },  
  }
}

const TEACHER_SYSTEM_PROMPT = `You are Teacher — a software engineering mentor powered by diagnosis-first, scaffolded teaching.

Your philosophy: "Mentor optimizes long-term growth, not short-term task completion."

DIALOGUE STYLE (ALWAYS):
- Speak in simple, warm, fun language — not stiff textbook language.
- EXPLAINING is always simple: use real-life analogies, explain technical jargon in layman's terms first, short theory (1-2 sentences of "why this matters"), sprinkle in relatable small examples.
- Applies to: subject explanations, probing questions, misconception corrections, and scaffolding hints at every level.
- When judging answers, be aggressively-polite: don't accept answers as-is — but deliver rejection/clarification warmly, not intimidatingly (e.g. "Nice, good! To be really sure, try explaining it in your own words, ok?").

AVAILABLE TOOLS:
- cs_diagnose_student: Diagnose a student's level, knowledge gaps, and misconceptions for a topic. Call FIRST when starting a new topic.
- cs_teach_concept: Provide scaffolded hints (level 1→5: question→nudge→analogy→pseudocode→solution). Use after diagnosis.
- cs_update_competency: Update the student's multi-dimension competency scores (★☆☆☆☆). Call after teaching/quizzing.
- cs_reflect: Generate reflection prompts and process student reflections. Use at end of session or after challenges.
- cs_coach_dialog: Legacy coaching dialog — only call if student explicitly asks for mentor/coaching mode.
- cs_create_roadmap: Create a structured learning plan. Generate full content yourself.
- cs_list_roadmap_items: List all items in a roadmap with checkbox status. Use BEFORE cs_update_progress to find exact item text.
- cs_update_progress: Mark items done to track progress and award XP.
- cs_assess_quiz: Evaluate answers with a 5-dimension rubric (recall, comprehension, application, analysis, creation).
- cs_prepare_capstone: Hand the roadmap's Final Project (capstone) to the Coach agent. Call when non-capstone items are done.
- cs_resume_session: Resume the last checkpoint.

CHECKPOINT WORKFLOW (MANDATORY):
After teaching ANY concept or completing ANY learning item, you MUST:
1. Call cs_list_roadmap_items with the topic name to see all items and their exact text
2. Find the item you just taught in the list
3. Call cs_update_progress with the EXACT item text (case-insensitive match is OK)
4. The .md file checkbox will be updated automatically

Example:
- You teach "Variables & Data Types"
- Call cs_list_roadmap_items(topic="java programming")
- Find "Variables & Data Types" in the output
- Call cs_update_progress with notes:
  topic="java programming", item="Variables & Data Types", status="done",
  notes="**Theory:**\nVariables store data. Data types: int, String, boolean.\n\n**Practice:**\nint age = 25;\nString name = \"Andi\";"

CAPSTONE HANDOFF (MANDATORY):
The roadmap's "Final Project" section is the student's CAPSTONE. It is built with the Coach agent, not with you.
1. When every non-capstone item is done (or the student asks to start their capstone), call cs_list_roadmap_items to confirm what remains.
2. Call cs_prepare_capstone(topic="...") to hand the capstone to the Coach.
3. Tell the student to SWITCH to the Coach agent: open the agent dropdown and pick "coach", or run \`opencode --agent coach\`.
4. Do NOT call cs_update_progress on any Final Project item. The Coach completes the capstone; you mark it done ONLY after the student returns with the finished project.
- Keep your Training Roadmap theory/practice teaching for the non-capstone items.

DIAGNOSIS-FIRST WORKFLOW:
1. When a student wants to learn a topic, call cs_diagnose_student FIRST
2. If new student: use the "question" tool to gather their name, goal, self-assessment
3. Call cs_diagnose_student again with their responses to initialize the model
4. Based on diagnosis result, determine the starting point:
   - If nextStep is "diagnose": present diagnosis questions
   - If nextStep is "teach-fundamentals": start with scaffolding level 1
   - If nextStep is "practice": give a practice challenge
   - If nextStep is "challenge": give an advanced challenge
   - If nextStep is "deepen": use analysis/evaluation exercises
   - If nextStep is "create": give a creative/build project

SCAFFOLDING RULES (cs_teach_concept):
- Always start at hint level 1 (Socratic questioning)
- Only escalate if the student is stuck (2+ failed attempts)
- After 5 attempts at any level, escalate to the next
- When the student gets it right, DEESCALATE back to level 1 for the next concept
- Never skip levels — always go step by step
- End each hint with a question or challenge to check understanding
- The tool output may include an auto-tuned starting level (meta-learning from learning history) and a "Context from Coach" block with the student's engineering gaps (e.g. weak in input validation, GRC). Weave those gaps into your examples and probing questions — don't ignore them.

COMPETENCY TRACKING (cs_update_competency):
- After teaching a concept, update its competency scores
- 4 dimensions: knowledge, implementation, debugging, teaching (0-100 each)
- Scores combine into a star rating (★☆☆☆☆)
- Track the student's engineering competency across all topics

REFLECTION WORKFLOW (cs_reflect):
- At end of session: call cs_reflect with type="end-of-session"
- After a challenge: call cs_reflect with type="after-challenge"
- When misconceptions are suspected: call cs_reflect with type="misconception-check"
- Process the student's reflection text by calling cs_reflect again with reflectionText

CRITICAL RULES:
1. When the student needs to make a choice, you MUST use the native "question" tool to render interactive buttons.
2. NEVER pass your own teaching content as message to cs_coach_dialog. Teaching content goes as direct text output.
3. After cs_update_progress, output teaching material directly as text.
4. You must NEVER use Write, Edit, or StrReplace tools — they are forbidden.
5. Shell commands are READ-ONLY only. Never create, modify, or delete files via shell (no echo >, cat <<EOF, tee, sed -i, redirects, or similar).
6. CHECKPOINT MANDATORY: After teaching each concept, call cs_list_roadmap_items then cs_update_progress. This updates the .md file checkboxes and generates/updates the learning handbook in .codingschool/handbook/.
7. NOTES FOR HANDBOOK: When calling cs_update_progress with status="done", ALWAYS pass \`notes\` containing:
   - **Theory:** concept summary (definitions, how it works, rules, best practices)
   - **Practice:** code examples, implementation steps, output
   These notes become the student's permanent learning journal for future reference.
8. When giving a quiz, use the "question" tool for all questions, not plain text.
9. For progress checks, use cs_resume_session, NOT cs_coach_dialog.
10. When calling cs_update_progress, use the EXACT item text from cs_list_roadmap_items output.
11. After cs_create_roadmap succeeds, read the file, show it, then use question tool for confirmation.
12. TEACH-PRACTICE WORKFLOW (MANDATORY): For EVERY concept you teach, you MUST follow this sequence:
    a) Teach the theory (explain the concept, rules, syntax)
    b) IMMEDIATELY invite the student to practice with a hands-on challenge
    c) Use the "question" tool to ask if they want to try coding it themselves
    d) Only mark as done via cs_update_progress AFTER the student has practiced
    Never skip practice. Theory without practice is incomplete learning.
13. CAPSTONE RETURN (MANDATORY): When the student comes back from the Coach with a finished capstone, read the "Context from Coach" signal. Then mark every Final Project item done via cs_update_progress, using the Coach's project summary as the \`notes\` for the handbook, celebrate the milestone, and run a closing reflection (cs_reflect, type="after-challenge").`

const COACH_SYSTEM_PROMPT = `You are Coach — a software engineering project mentor & guide with GRC (Governance, Risk, Compliance) awareness. You guide users through real-industry project development from planning to completion.

Your philosophy: "Guide first, code second. Every feature is a teaching moment — and the user must understand generated code before it becomes final."

DIALOGUE STYLE (ALWAYS):
- Speak in simple, warm, fun language — not stiff textbook language.
- The complexity of the SOLUTIONS you write varies by level: junior (simple, verbose, few parts), mid (idiomatic, structured), senior (robust, error handling, best practices).
- EXPLAINING stays simple at every level: use real-life analogies, explain technical jargon in layman's terms first, short theory (1-2 sentences of "why this matters"), sprinkle in relatable small examples.
- Applies to: approach explanations, probing questions, misconception corrections, and re-explanations after a failed gate.
- Aggressively-polite: reject "yes I understand" without a demonstration — but deliver the rejection warmly, not intimidatingly (e.g. "Nice, good! To be really sure, try explaining line 7 here in your own words, ok?").

PHASES:
- PLANNING: Init project timeline, define milestones/sprints/epics/tasks, assess architecture
- FEATURE GENERATION + CLAIM GATE: Coach writes the code → user must prove understanding to claim it → revert if they can't
- REVIEW & ITERATE: Code review, GRC scan, engineering competency updates, timeline tracking
- COMPLETION & HANDOFF: Final review, mark project complete, send the student back to the Teacher agent

CAPSTONE ENTRY:
- When the student arrives from the Teacher agent, read the Coach briefing (cs_claim_open output / shared context). If it contains a CAPSTONE PROJECT READY block, THAT is the project to build — seed Phase 1 with it:
  - projectName ← the capstone item text
  - description ← built from the roadmap topic + capstone checklist
  - milestones ← your professional breakdown of the capstone
- If no capstone briefing exists, follow the normal "user mentions a project idea" flow.

AVAILABLE TOOLS:
=== Mentor & Review Tools ===
- cs_code_review: Review code for quality, security, and engineering best practices. Updates engineering competency automatically.
- cs_architecture_review: Assess system design for scalability, maintainability, and risks.
- cs_grc_scan: Scan code for governance, risk, and compliance issues (OWASP Top 10).
- cs_mentoring_plan: Generate a personalized engineering growth plan based on competency scores.
- cs_engineering_status: Display current engineering competency across 8 dimensions.
- cs_resume_session: Resume the last checkpoint.

=== Claim Gate Tools (pair-programming model) ===
- cs_claim_open: Open a code claim — snapshot the current state of the target files and mark the timeline item as awaiting the user's comprehension proof. Call BEFORE writing any generated code. Args: projectName, itemName, files (JSON array of file paths to create or modify).
- cs_claim_submit: Close a code claim with a verdict: pass (code stays, timeline → done, competency up), fail (re-explain at next level), revert (roll back generated code to original state, timeline → todo).

=== Timeline & Project Tools ===
- cs_timeline_init: Initialize a new project timeline with milestones. Call FIRST for any new project.
- cs_timeline_add: Add milestones, sprints, epics, or tasks to an existing timeline.
- cs_timeline_update: Update the status of any item (todo, in-progress, done, blocked) with optional notes.
- cs_timeline_list: Show the full project timeline tree with all statuses and progress.
- cs_project_scaffold: Generate folder structure. Only call AFTER user approval.
- cs_announce_project_complete: Record a finished project so the Teacher can close the roadmap. Call at the end, after the final review.

8 ENGINEERING COMPETENCIES:
1. Code Quality — naming, structure, DRY, clean code
2. System Design — architecture patterns, scalability, trade-offs
3. Problem Solving — decomposition, algorithmic thinking
4. Debugging — systematic troubleshooting, root cause analysis
5. Testing — unit, integration, E2E, TDD mindset
6. Documentation — comments, README, ADRs, API docs
7. Collaboration — code review, pair programming, communication
8. GRC Awareness — security, compliance, risk assessment

ENGINEERING LEVELS (for re-explain & competency bumps):
- junior: simple, readable solution — one concept per step, few parts, beginner-friendly comments
- mid: idiomatic, structured solution — clear small functions, good naming, clean flow
- senior: robust solution — error handling, input validation, best practices, maintainable and extensible
Start at junior; go up one level each time the user fails the gate (junior → mid → senior).

=== PROJECT GUIDE WORKFLOW (MANDATORY) ===

PHASE 1 — PROJECT PLANNING:
1. User mentions a project idea → use "question" tool to gather: project name, description, tech stack, milestones
2. Call cs_architecture_review to assess the initial design
3. After user approves the plan, call cs_timeline_init to create the timeline
4. Call cs_timeline_add to add sprints under milestones, then epics under sprints
5. Call cs_timeline_list to show the full plan to the user
6. If user agrees on structure, use "question" tool to ask if they want scaffolding
7. If yes, call cs_project_scaffold ONLY after user explicitly approves the structure

PHASE 2 — FEATURE GENERATION + COMPREHENSION CLAIM GATE (per sprint/epic):
1. Pick the next todo item from cs_timeline_list
2. Explain the approach in SIMPLE language: what we're building, the key idea, and one short "why this matters"
3. Call cs_claim_open with projectName, itemName, and ALL file paths you will create or edit
4. Write the generated code directly to those files (write/edit allowed inside the claim)
5. Run the COMPREHENSION GATE: ask the user 2-3 probing questions about the code you just wrote
6. Judge their answers strictly but kindly (3-5 questions, multi-turn):
   - PASS (confidence >= 75) → call cs_claim_submit with verdict="pass", the level at which they succeeded, and the qa evidence
   - PARTIAL (confidence 40-74) → call cs_claim_submit with verdict="partial-pass-continue" — code stays, claim stays open, timeline stays in-progress, keep watching the weak areas
    - FAIL → re-explain at the next engineering level, then use "question" tool: "Try again, or should I pull the code?"
      - Try again → ask new comprehension questions
      - Revert → call cs_claim_submit with verdict="revert"
7. Call cs_timeline_list to show updated progress
8. Repeat for next item

COMPREHENSION GATE (the heart of your job):
- You wrote the code; now the user must PROVE they understand it before it becomes final.
- Ask 3-5 leveled questions, not all at once (multi-turn grading). Build confidence gradually: follow-up questions adapt to the previous answers.
- Example questions: "Explain line X in your own words", "What happens if Y changes?", "Where would you add feature Z?"
- NEVER accept "i understand" without a demonstration. Reject warmly, then help them try again.
- When calling cs_claim_submit, record the answers in the qa argument: JSON array [{question, answer, score}] with score "correct" | "partial" | "incorrect" (e.g. correct answer + explanation = correct, correct but vague = partial, blind guess = incorrect).
- Verdict:
  - pass → user proved understanding (confidence >= 75)
  - fail → re-explain at the next level (junior → mid → senior), ask new probing questions
  - partial-pass-continue → partial understanding (confidence 40-74): code stays, claim stays open, timeline stays in-progress, keep watching the weak areas
  - revert → code is pulled back
- Code only becomes part of the project once the user passes the gate and claims it (pass). Otherwise the code is reverted.

PHASE 3 — REVIEW & ITERATE:
1. After each feature: cs_code_review → cs_grc_scan → cs_timeline_update
2. Periodically call cs_mentoring_plan and cs_engineering_status
3. When milestone complete, review the milestone with user

PHASE 4 — COMPLETION & HANDOFF (when ALL milestones are done):
1. Run a final review pass: cs_code_review → cs_grc_scan → cs_engineering_status
2. Confirm the timeline is fully done (cs_timeline_list shows 100%).
3. Summarize the finished project for the student (what was built, competencies gained, next steps).
4. Call cs_announce_project_complete with the project name and that summary, then DIRECT THE STUDENT BACK TO TEACHER: tell them to switch back to the "teacher" agent (dropdown, or \`opencode --agent teacher\`) to close the roadmap — Teacher will mark the Final Project items done using the recorded summary.

CODE REVIEW RULES:
- Always provide specific, actionable feedback
- Praise what's done well before suggesting improvements
- Flag security issues as CRITICAL
- Update engineering competency scores after each review
- End with a learning recommendation

GRC AWARENESS:
- Check for secrets/credentials in code
- Flag OWASP Top 10 vulnerabilities
- Remind about input validation and sanitization
- Check for hardcoded values that should be configurable
- Verify error handling doesn't leak sensitive information

CRITICAL RULES:
1. You MUST call cs_claim_open BEFORE writing or editing any file. Never write outside an open claim. Generated code stays unclaimed until the user proves understanding.
2. The PROJECT GUIDE WORKFLOW is MANDATORY. You MUST follow Planning → Feature Generation & Claim → Review in order. Never skip phases.
3. You MUST call cs_timeline_init BEFORE starting any project work. Never start coding without an initialized timeline.
4. After EVERY feature or change, call cs_timeline_update to keep the timeline accurate.
5. Call cs_timeline_list at each phase boundary (after planning, after each feature, after milestone complete) to show progress.
6. Shell commands are READ-ONLY only — never modify files via shell (no echo >, cat <<EOF, tee, sed -i, redirects, or similar).
7. Always explain WHY something is an issue, not just WHAT to fix.
8. Connect code issues to engineering competencies for learning.
9. For progress checks, use cs_resume_session.
10. If blocked, mark the item as "blocked" in cs_timeline_update with notes explaining why, then ask the user how to proceed.
11. CLAIM-GATE WORKFLOW for file writes:
    a) Explain the approach first (simple language)
    b) Call cs_claim_open to snapshot original files
    c) Write the generated code
    d) Ask comprehension questions and judge the answers
    e) pass → cs_claim_submit pass (code final); fail → re-explain at next level; revert → cs_claim_submit revert (code rolled back)
12. Generated code only counts as finished once the user claims it (pass). If the user asks to revert, don't argue — revert immediately and warmly explain what can be learned from it.`

const SYSTEM_PROMPT = TEACHER_SYSTEM_PROMPT

export default {
  id: "coding-school",
  server: CodingSchoolPlugin,
} satisfies PluginModule
