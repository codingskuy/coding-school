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
  handleProjectMentoring,
} from "./coach"
import { detectIntent, onboardingMessage, roadmapConfirmPrompt } from "./utils/templates"
import { createRoadmap } from "./roadmap/generator"
import { getProgress, updateProgress, renderDashboard } from "./progress/tracker"
import { assessQuiz, renderAssessment, saveAssessment } from "./assessment/engine"
import { resumeSession, createOrUpdateSession, getLatestSessionInfo } from "./session/resume"
import { isProfileExists } from "./utils/paths"
import { updateChecklistInFile } from "./utils/fs"
import { existsSync, readdirSync } from "fs"

import { progressPath } from "./utils/paths"
import { diagnoseStudent, generateDiagnosisQuestions, buildInitialDiagnosisPrompt } from "./diagnosis"
import { getScaffolding, buildScaffoldingPrompt, shouldEscalateHint } from "./scaffolding"
import { generateReflectionPrompt, processSessionReflection, extractInsights } from "./reflection"
import { loadStudentModel, saveStudentModel } from "./student-model"
import { updateTopicCompetency, renderTopicCompetency, renderEngineeringCompetency } from "./competency"
import { migrate, isMigrationNeeded } from "./migration"
import type { ProgressData, StudentModel, BloomStage } from "./utils/types"
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
          return `Learning plan created at \`${path}\`\n\n${roadmapConfirmPrompt()}`
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
          if (args.status === "done") {
            const roadmapDir = join(projectDir, ".codingschool", "roadmap", args.topic.toLowerCase())
            if (existsSync(roadmapDir)) {
              const files = readdirSync(roadmapDir).filter(f => f.endsWith(".md"))
              for (const file of files) {
                updateChecklistInFile(join(roadmapDir, file), args.item)
              }
            }
          }
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
            return `Last checkpoint: session **${latest.date}**.
- Topic: ${latest.data.topic}
- Progress: ${latest.data.progressPercent}%
- Bloom Stage: ${latest.data.bloomStage}

Continue learning or start a new topic?`
          }

          const progress = getProgress(projectDir)
          const topics = Object.entries(progress.topics)
          if (topics.length > 0) {
            const lines = topics.map(([name, t]) => {
              const nextItem = [...t.theory, ...t.practice].find(
                i => !t.completedTheory.includes(i) && !t.completedPractice.includes(i),
              )
              return `- **${name}**: ${t.percent}% complete${nextItem ? `\n  Next: ${nextItem}` : t.percent === 100 ? "\n  ✅ COMPLETED" : ""}`
            })
            const topicKeys = topics.map(([name]) => name)
            return `Found existing progress in progress.json:\n${lines.join("\n")}\n\nXP: ${progress.xp} | Level: ${progress.level}\n\nIMPORTANT: When calling cs_update_progress, use the EXACT topic key: "${topicKeys[0]}"\n\nContinue learning or start a new topic?`
          }

          return "No previous learning sessions found. Start your learning journey now!"
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
          const responses: Record<string, string> = {}
          if (args.name) responses.name = args.name
          if (args.goal) responses.goal = args.goal
          if (args.selfAssessment) responses.selfAssessment = args.selfAssessment
          if (args.knownConcepts) responses.knownConcepts = args.knownConcepts
          if (args.priorExperience) responses.priorExperience = args.priorExperience

          const hasResponses = Object.keys(responses).length > 0
          const result = diagnoseStudent(args.topic, hasResponses ? responses : undefined)

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
          const model = loadStudentModel()
          const result = getScaffolding({
            topic: args.topic,
            concept: args.concept,
            studentAnswer: args.studentAnswer,
            studentModel: model,
          })

          const effectiveLevel = (args.hintLevel || result.hintLevel) as HintLevel

          const lines: string[] = []
          lines.push(`**Scaffolding — Level ${effectiveLevel}/5: ${result.technique}**`)
          lines.push("")
          lines.push(result.hint)
          lines.push("")
          lines.push(`Next action: ${result.nextAction}`)
          if (result.escalateHint) {
            lines.push("")
            lines.push("*Note: Student seems stuck. Consider escalating to the next hint level.*")
          }
          return lines.join("\n")
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

          const lines: string[] = []
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
        },
      }),

      cs_code_review: tool({
        description: "Review code for quality, security, and engineering best practices. Updates engineering competency scores automatically.",
        args: {
          code: tool.schema.string(),
          context: tool.schema.string().optional(),
        },
        async execute(args) {
          const result = handleCodeReview(projectDir, args.code, args.context)
          return result.message
        },
      }),

      cs_architecture_review: tool({
        description: "Assess a system architecture or design for scalability, maintainability, and risks.",
        args: {
          description: tool.schema.string(),
          patterns: tool.schema.string().optional(),
        },
        async execute(args) {
          const result = handleArchitectureReview(projectDir, args.description, args.patterns)
          return result.message
        },
      }),

      cs_grc_scan: tool({
        description: "Scan code for governance, risk, and compliance issues including OWASP Top 10 vulnerabilities.",
        args: {
          code: tool.schema.string(),
          context: tool.schema.string().optional(),
        },
        async execute(args) {
          const result = handleGRCScan(projectDir, args.code, args.context)
          return result.message
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
    },

    config: async (config) => {
      config.agent ??= {}

      // Backward-compatible: old agent ID redirects to learn (hidden from selector)
      config.agent["coding-school"] = {
        description: "Software engineering learning mentor (legacy — redirects to learn)",
        prompt: LEARN_SYSTEM_PROMPT,
        mode: "subagent",
      }
      const permLegacy: Record<string, string> = { question: "allow", "cs_*": "allow" }
      config.agent["coding-school"].permission = permLegacy

      // New learn agent
      config.agent["learn"] = {
        description: "Software engineering learning mentor — diagnosis-first, scaffolded teaching, reflection-driven",
        prompt: LEARN_SYSTEM_PROMPT,
        mode: "primary",
      }
      const perm: Record<string, string> = { question: "allow", "cs_*": "allow" }
      config.agent["learn"].permission = perm

      // Coach agent — engineering mentor with GRC
      config.agent["coach"] = {
        description: "Software engineering project mentor — code review, architecture, GRC awareness, engineering competency",
        prompt: COACH_SYSTEM_PROMPT,
        mode: "primary",
      }
      config.agent["coach"].permission = { ...perm }
    },

    event: async () => {
      // no-op — .codingschool/ dirs created lazily by tools
    },

    "permission.ask": async (input, output) => {
      if (input.id === "question") {
        output.status = "allow"
      }
    },  
  }
}

const LEARN_SYSTEM_PROMPT = `You are Learn — a software engineering mentor powered by diagnosis-first, scaffolded teaching.

Your philosophy: "Mentor optimizes long-term growth, not short-term task completion."

AVAILABLE TOOLS:
- cs_diagnose_student: Diagnose a student's level, knowledge gaps, and misconceptions for a topic. Call FIRST when starting a new topic.
- cs_teach_concept: Provide scaffolded hints (level 1→5: question→nudge→analogy→pseudocode→solution). Use after diagnosis.
- cs_update_competency: Update the student's multi-dimension competency scores (★☆☆☆☆). Call after teaching/quizzing.
- cs_reflect: Generate reflection prompts and process student reflections. Use at end of session or after challenges.
- cs_coach_dialog: Legacy coaching dialog — only call if student explicitly asks for mentor/coaching mode.
- cs_create_roadmap: Create a structured learning plan. Generate full content yourself.
- cs_update_progress: Mark items done to track progress and award XP.
- cs_assess_quiz: Evaluate answers with a 5-dimension rubric (recall, comprehension, application, analysis, creation).
- cs_resume_session: Resume the last checkpoint.

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
4. You cannot write or edit files for the student. Guide them to write their own code.
5. Shell commands are READ-ONLY only: git log/diff/status, ls, bun test, bun run.
6. ALWAYS call cs_update_progress after teaching each topic item.
7. When giving a quiz, use the "question" tool for all questions, not plain text.
8. For progress checks, use cs_resume_session, NOT cs_coach_dialog.
9. When calling cs_update_progress, use the EXACT topic key from cs_resume_session output.
10. After cs_create_roadmap succeeds, read the file, show it, then use question tool for confirmation.`

const COACH_SYSTEM_PROMPT = `You are Coach — a software engineering project mentor with GRC (Governance, Risk, Compliance) awareness.

Your philosophy: "Every code review is a teaching moment. Every architecture decision has trade-offs."

AVAILABLE TOOLS:
- cs_code_review: Review code for quality, security, and engineering best practices. Updates engineering competency automatically.
- cs_architecture_review: Assess system design for scalability, maintainability, and risks.
- cs_grc_scan: Scan code for governance, risk, and compliance issues (OWASP Top 10).
- cs_mentoring_plan: Generate a personalized engineering growth plan based on competency scores.
- cs_engineering_status: Display current engineering competency across 8 dimensions.
- cs_coach_dialog: Legacy coaching dialog for intent detection.
- cs_create_roadmap: Create a structured learning plan.
- cs_update_progress: Mark items done to track progress.
- cs_assess_quiz: Evaluate answers with a 5-dimension rubric.
- cs_resume_session: Resume the last checkpoint.

8 ENGINEERING COMPETENCIES:
1. Code Quality — naming, structure, DRY, clean code
2. System Design — architecture patterns, scalability, trade-offs
3. Problem Solving — decomposition, algorithmic thinking
4. Debugging — systematic troubleshooting, root cause analysis
5. Testing — unit, integration, E2E, TDD mindset
6. Documentation — comments, README, ADRs, API docs
7. Collaboration — code review, pair programming, communication
8. GRC Awareness — security, compliance, risk assessment

PROJECT MENTORING WORKFLOW:
1. When the student shares code, call cs_code_review
2. When discussing architecture, call cs_architecture_review
3. When security is mentioned, call cs_grc_scan
4. Periodically call cs_mentoring_plan to show growth areas
5. Use cs_engineering_status to show overall progress

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
1. When the student needs to make a choice, use the native "question" tool.
2. You cannot write or edit files for the student. Guide them.
3. Shell commands are READ-ONLY only.
4. Always explain WHY something is an issue, not just WHAT to fix.
5. Connect code issues to engineering competencies for learning.
6. For progress checks, use cs_resume_session.`

const SYSTEM_PROMPT = LEARN_SYSTEM_PROMPT

export default {
  id: "coding-school",
  server: CodingSchoolPlugin,
} satisfies PluginModule
