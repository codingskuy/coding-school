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
} from "../coach"
import { openClaim, submitClaim } from "../coach-gate"
import { detectIntent, onboardingMessage, roadmapConfirmPrompt } from "../utils/templates"
import { createRoadmap, listRoadmapItems, isPhaseProjectItem, isCapstoneSection } from "../roadmap/generator"
import { getProgress, updateProgress, renderDashboard } from "../progress/tracker"
import { assessQuiz, renderAssessment, saveAssessment } from "../assessment/engine"
import { resumeSession, getLatestSessionInfo } from "../session/resume"
import { isProfileExists } from "../utils/paths"
import { updateChecklistInFile } from "../utils/fs"
import { generateHandbook } from "../handbook/generator"
import { existsSync, readdirSync } from "fs"
import { diagnoseStudent } from "../diagnosis"
import { getScaffolding } from "../scaffolding"
import { announceDiagnosis, getTeachingSignals, getCoachBriefing, announceCapstone, announceProjectComplete } from "../context"
import { checkRequirements, renderRequirementsReport } from "../requirements"
import { initLearningEnv } from "../init-learning-env"
import { checkPublishEnv, previewPublish, publishToGitHub } from "../publish"
import { recordTool, checkAdvisories } from "../workflow"
import { traceTool } from "../trace"
import { scaffoldingOffset, applyScaffoldingOffset } from "../meta"
import { generateReflectionPrompt, processSessionReflection } from "../reflection"
import { loadStudentModel } from "../student-model"
import { updateTopicCompetency, renderTopicCompetency, renderEngineeringCompetency } from "../competency"
import { initTimeline, addTimelineItem, updateTimelineItem, listTimeline, scaffoldProject } from "../timeline/generator"
import type { BloomStage, TimelineStatus, EngineeringLevel, ComprehensionAnswer } from "../utils/types"
import type { HintLevel } from "../scaffolding"
import { studentSwitchHint } from "../personas/platform-hints"
import { defineTool, type ToolContext } from "./types"

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

export function createToolRegistry({ projectDir, platform }: ToolContext) {
  return {
    cs_coach_dialog: defineTool({
      description: "Start a dialog with the CodingSchool coach. Call when the user wants to learn or needs guidance.",
      args: (z) => ({
        message: z.string(),
        choice: z.string().optional(),
      }),
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

    cs_create_roadmap: defineTool({
      description: "Create a new learning roadmap for a specific topic. The AI must generate the full roadmap content and pass it in the content argument.",
      args: (z) => ({
        topic: z.string(),
        level: z.enum(["beginner", "intermediate", "expert"]),
        content: z.string(),
      }),
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

    cs_update_progress: defineTool({
      description: "Update the user's learning progress. Mark items as completed in the roadmap.",
      args: (z) => ({
        topic: z.string(),
        item: z.string(),
        status: z.enum(["done", "skipped", "in-progress"]),
        notes: z.string().optional(),
      }),
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

    cs_assess_quiz: defineTool({
      description: "Provide a rubric-based assessment of the user's answers in a quiz or learning session.",
      args: (z) => ({
        answers: z.string(),
        topic: z.string(),
        stage: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
      }),
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

    cs_prepare_capstone: defineTool({
      description:
        "Hand a roadmap project (phase project or final capstone) to the Coach agent. For phase projects: call when all learning items before the project are done. For capstone: call when all non-capstone items are done. Reads project items from the roadmap and flags them as ready for the Coach agent.",
      args: (z) => ({
        topic: z.string(),
        type: z.enum(["phase", "capstone"]).optional(),
        phaseLabel: z.string().optional(),
        projectName: z.string().optional(),
      }),
      async execute(args) {
        const items = listRoadmapItems(projectDir, args.topic)
        if (items.length === 0) {
          return `No roadmap found for topic "${args.topic}". Create a roadmap first with cs_create_roadmap.`
        }
        const projectType = args.type ?? "capstone"

        if (projectType === "capstone") {
          const capstone = items.filter(i => isCapstoneSection(i.section))
          if (capstone.length === 0) {
            return `No "## Final Project" section found in the roadmap for "${args.topic}". Add a Final Project section, then try again.`
          }
          const capItems = capstone.map(i => i.text)
          announceCapstone(projectDir, {
            topic: args.topic,
            items: capItems,
            ready: true,
            type: "capstone",
            projectName: args.projectName ?? capItems[0],
          })
          recordTool(projectDir, { toolName: "cs_prepare_capstone", topic: args.topic })
          const projName = args.projectName ?? capItems[0]
          return `Capstone prepared for the Coach agent.

Project: **${projName}** (from topic "${args.topic}" roadmap)
Checklist:
${capItems.map(i => `- [ ] ${i}`).join("\n")}

The Coach agent will see this capstone briefing when it starts. Tell the student:
"Bagus sekali! Sekarang pindah ke ${studentSwitchHint(platform, "coach")} untuk membangun proyek capstone: **${projName}**. Coach akan memandu dari perencanaan sampai proyek selesai."
(Do NOT mark Final Project items as done here — Coach completes them.)`
        }

        // Phase project
        const phaseProjects = items.filter(i =>
          !isCapstoneSection(i.section) && isPhaseProjectItem(i.text),
        )
        if (phaseProjects.length === 0) {
          return `No phase project items (e.g. "Proyek N: ..." or 🚀) found in the roadmap for "${args.topic}".`
        }
        const unchecked = phaseProjects.filter(i => !i.checked)
        if (unchecked.length === 0) {
          return `All phase projects are already completed!`
        }
        const target = unchecked[0]
        const projName = args.projectName ?? target.text
        const phaseLabel = args.phaseLabel ?? target.section
        announceCapstone(projectDir, {
          topic: args.topic,
          items: [target.text],
          ready: true,
          type: "phase",
          projectName: projName,
          phaseLabel,
        })
        recordTool(projectDir, { toolName: "cs_prepare_capstone", topic: args.topic })
        return `Phase project prepared for the Coach agent.

Project: **${projName}** (${phaseLabel})
Section: ${target.section}

The Coach agent will see this project briefing when it starts. Tell the student:
"Bagus! Semua materi ${phaseLabel} sudah selesai. Sekarang pindah ke ${studentSwitchHint(platform, "coach")} untuk mengerjakan proyek: **${projName}**. Coach akan memandu dari perencanaan sampai proyek selesai, lalu kamu kembali ke Teacher untuk lanjut ke phase berikutnya."
(Do NOT mark phase project items as done here — Coach completes them.)`
      },
    }),

    cs_resume_session: defineTool({
      description: "Load the previous learning session. Check .codingschool/sessions/ for the last checkpoint, or .codingschool/progress.json for existing progress.",
      args: (z) => ({
        date: z.string().optional(),
      }),
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

    cs_list_roadmap_items: defineTool({
      description: "List all items in a topic's roadmap with their checkbox status. Use this to find the exact item name before calling cs_update_progress.",
      args: (z) => ({
        topic: z.string(),
      }),
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

    cs_diagnose_student: defineTool({
      description: "Diagnose a student's current level, knowledge gaps, and misconceptions for a given topic. Call this when starting a new topic or when the student seems lost.",
      args: (z) => ({
        topic: z.string(),
        name: z.string().optional(),
        goal: z.string().optional(),
        selfAssessment: z.string().optional(),
        knownConcepts: z.string().optional(),
        priorExperience: z.string().optional(),
      }),
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

    cs_teach_concept: defineTool({
      description: "Provide scaffolding for teaching a concept. Returns hints at the appropriate level based on the student's competency. Call cs_diagnose_student first to determine the starting hint level.",
      args: (z) => ({
        topic: z.string(),
        concept: z.string().optional(),
        studentAnswer: z.string().optional(),
        hintLevel: z.number().optional(),
      }),
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

    cs_update_competency: defineTool({
      description: "Update the student's competency scores for a specific topic. Call after teaching, quizzing, or reviewing material.",
      args: (z) => ({
        topic: z.string(),
        knowledge: z.number().optional(),
        implementation: z.number().optional(),
        debugging: z.number().optional(),
        teaching: z.number().optional(),
      }),
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

    cs_reflect: defineTool({
      description: "Generate a reflection prompt for the student. Use at end of session, after a challenge, or to check for misconceptions.",
      args: (z) => ({
        topic: z.string(),
        type: z.enum(["end-of-session", "after-challenge", "misconception-check", "progress-review"]),
        reflectionText: z.string().optional(),
        bloomStage: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]).optional(),
      }),
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

    cs_code_review: defineTool({
      description: "Review code for quality, security, and engineering best practices. Updates engineering competency scores automatically.",
      args: (z) => ({
        code: z.string(),
        context: z.string().optional(),
      }),
      async execute(args) {
        return traceTool(projectDir, "coach", "cs_code_review", args, async () => {
          const result = handleCodeReview(projectDir, args.code, args.context)
          return result.message
        })
      },
    }),

    cs_architecture_review: defineTool({
      description: "Assess a system architecture or design for scalability, maintainability, and risks.",
      args: (z) => ({
        description: z.string(),
        patterns: z.string().optional(),
      }),
      async execute(args) {
        return traceTool(projectDir, "coach", "cs_architecture_review", args, async () => {
          const result = handleArchitectureReview(projectDir, args.description, args.patterns)
          return result.message
        })
      },
    }),

    cs_grc_scan: defineTool({
      description: "Scan code for governance, risk, and compliance issues including OWASP Top 10 vulnerabilities.",
      args: (z) => ({
        code: z.string(),
        context: z.string().optional(),
      }),
      async execute(args) {
        return traceTool(projectDir, "coach", "cs_grc_scan", args, async () => {
          const result = handleGRCScan(projectDir, args.code, args.context)
          return result.message
        })
      },
    }),

    cs_mentoring_plan: defineTool({
      description: "Generate a personalized engineering growth plan based on current competency scores.",
      args: (z) => ({
        topic: z.string(),
      }),
      async execute(args) {
        const result = handleMentoringPlan(projectDir, args.topic)
        return result.message
      },
    }),

    cs_engineering_status: defineTool({
      description: "Display the student's current engineering competency scores across all 8 dimensions.",
      args: () => ({}),
      async execute() {
        const result = handleEngineeringStatus(projectDir)
        return result.message
      },
    }),

    // ════════════════════════════════════════════
    // Timeline Tools — Project Guide
    // ════════════════════════════════════════════

    cs_timeline_init: defineTool({
      description: "Initialize a new project timeline with milestones. Starts project planning phase.",
      args: (z) => ({
        projectName: z.string(),
        description: z.string(),
        techStack: z.string(),
        milestones: z.string(),
      }),
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

    cs_timeline_add: defineTool({
      description: "Add a milestone, sprint, epic, or task to an existing timeline. For sprints/epics/tasks, provide parentName.",
      args: (z) => ({
        projectName: z.string(),
        type: z.enum(["milestone", "sprint", "epic", "task"]),
        name: z.string(),
        parentName: z.string().optional(),
        notes: z.string().optional(),
      }),
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

    cs_timeline_update: defineTool({
      description: "Update the status of any timeline item (milestone/sprint/epic/task). Status: todo, in-progress, done, blocked.",
      args: (z) => ({
        projectName: z.string(),
        itemName: z.string(),
        status: z.enum(["todo", "in-progress", "done", "blocked"]),
        notes: z.string().optional(),
      }),
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

    cs_timeline_list: defineTool({
      description: "Show the full project timeline with milestones, sprints, epics, tasks, and their statuses.",
      args: (z) => ({
        projectName: z.string(),
      }),
      async execute(args) {
        return listTimeline(projectDir, args.projectName)
      },
    }),

    cs_project_scaffold: defineTool({
      description: "Generate the project folder structure after user approval. Structure must be a JSON object representing folders and files.",
      args: (z) => ({
        projectName: z.string(),
        structure: z.string(),
      }),
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

    cs_announce_project_complete: defineTool({
      description:
        "Record a finished project (phase project or capstone) so the Teacher agent can continue the roadmap. Call at the end of a project when all milestones are done; pass a summary of what was built.",
      args: (z) => ({
        projectName: z.string(),
        topic: z.string().optional(),
        summary: z.string(),
      }),
      async execute(args) {
        announceProjectComplete(projectDir, {
          projectName: args.projectName,
          topic: args.topic,
          summary: args.summary,
        })
        recordTool(projectDir, { toolName: "cs_announce_project_complete", projectName: args.projectName })
        return `Project completion recorded. The Teacher agent will see it and continue the roadmap.

Tell the student:
"Kerja bagus! Proyek **${args.projectName}** sudah selesai. Sekarang pindah kembali ke ${studentSwitchHint(platform, "teacher")} untuk menandai proyek selesai dan lanjut ke materi berikutnya."`
      },
    }),

    cs_claim_open: defineTool({
      description: "Open a code claim for Coach's pair-programming model: snapshot the current state of the target files and mark the timeline item as awaiting the user's comprehension proof. Call BEFORE writing any generated code. The generated code only becomes final when the user claims it (cs_claim_submit verdict=pass).",
      args: (z) => ({
        projectName: z.string(),
        itemName: z.string(),
        files: z.string(),
      }),
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

    cs_claim_submit: defineTool({
      description: "Close a code claim with a verdict: 'pass' (user proved understanding — code stays, timeline item → done, engineering competency bumped), 'fail' (attempts++ — re-explain at the next engineering level), 'partial-pass-continue' (code stays, claim stays open, timeline stays in-progress — watch the weak areas), or 'revert' (roll back generated code to its original state, timeline item → todo). Pass `qa` (JSON array of { question, answer, score }) to record multi-turn comprehension evidence.",
      args: (z) => ({
        projectName: z.string(),
        itemName: z.string(),
        verdict: z.string(),
        level: z.string().optional(),
        notes: z.string().optional(),
        qa: z.string().optional(),
        confidence: z.number().optional(),
      }),
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

    cs_check_requirements: defineTool({
      description:
        "Check if the student's system has the required tools and MCP servers for a topic. Call BEFORE starting to teach a new topic or build a project. Returns a report of installed/missing tools and MCP servers with install instructions.",
      args: (z) => ({
        topic: z.string(),
      }),
      async execute(args) {
        const report = checkRequirements(projectDir, args.topic)
        recordTool(projectDir, { toolName: "cs_check_requirements", topic: args.topic })
        return renderRequirementsReport(report)
      },
    }),

    cs_init_learning_env: defineTool({
      description:
        "Initialize a dedicated learning folder with git and .codingschool structure. Call when starting a new topic. The student must choose a folder name first.",
      args: (z) => ({
        topic: z.string(),
        folderName: z.string(),
      }),
      async execute(args) {
        const result = initLearningEnv(projectDir, args.topic, args.folderName)
        recordTool(projectDir, { toolName: "cs_init_learning_env", topic: args.topic })
        return result.message
      },
    }),

    cs_publish_handbook: defineTool({
      description:
        "Check, preview, or publish the learning folder to GitHub. Actions: 'check' (detect git/gh), 'preview' (list files + commits), 'publish' (create repo + push).",
      args: (z) => ({
        action: z.enum(["check", "preview", "publish"]),
        repoName: z.optional(z.string()),
        private: z.optional(z.boolean()),
      }),
      async execute(args) {
        if (args.action === "check") {
          const report = checkPublishEnv(projectDir)
          recordTool(projectDir, { toolName: "cs_publish_handbook", topic: "check" })
          return report.message
        }
        if (args.action === "preview") {
          const report = previewPublish(projectDir)
          recordTool(projectDir, { toolName: "cs_publish_handbook", topic: "preview" })
          return report.message
        }
        const repoName = args.repoName || "codingschool-handbook"
        const isPrivate = args.private !== false
        const report = publishToGitHub(projectDir, repoName, isPrivate)
        recordTool(projectDir, { toolName: "cs_publish_handbook", topic: repoName })
        return report.message
      },
    }),
  }
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>
