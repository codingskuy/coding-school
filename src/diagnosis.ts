import type { StudentModel, LearningLevel, KnowledgeNode, BloomStage } from "./utils/types"
import {
  loadStudentModel,
  saveStudentModel,
  initStudentModel,
  updateKnowledge,
  updateConfidence,
} from "./student-model"

export interface DiagnosisResult {
  isNew: boolean
  model: StudentModel
  level: LearningLevel
  confidence: number
  knownTopics: string[]
  unknownTopics: string[]
  misconceptions: string[]
  recommendedStyle: string
  greeting: string
  nextStep: string
}

export function diagnoseStudent(
  topic: string,
  userResponses?: Record<string, string>,
): DiagnosisResult {
  let model = loadStudentModel()

  const isNew = !model.name && !model.learningGoal && Object.keys(model.knowledge).length === 0

  if (isNew) {
    model = initStudentModel()
  }

  if (userResponses) {
    model = applyDiagnosisResponses(model, topic, userResponses)
  }

  const topicNode = model.knowledge[topic]
  const knownTopics = Object.keys(model.knowledge).filter(
    k => model.knowledge[k].confidence >= 50,
  )
  const unknownTopics = Object.keys(model.knowledge).filter(
    k => model.knowledge[k].confidence < 30,
  )
  const misconceptions = model.misconceptions
    .filter(m => !m.resolved && m.topic === topic)
    .map(m => m.description)

  const level = model.currentLevel
  const confidence = model.confidence
  const recommendedStyle = getRecommendedStyle(model)

  const greeting = isNew
    ? buildNewStudentGreeting(topic)
    : buildReturningStudentGreeting(model, topic)

  const nextStep = determineNextStep(model, topic)

  return {
    isNew,
    model,
    level,
    confidence,
    knownTopics,
    unknownTopics,
    misconceptions,
    recommendedStyle,
    greeting,
    nextStep,
  }
}

function applyDiagnosisResponses(
  model: StudentModel,
  topic: string,
  responses: Record<string, string>,
): StudentModel {
  if (responses.level) {
    const level = normalizeLevel(responses.level)
    model.currentLevel = level
  }

  if (responses.goal) {
    model.learningGoal = responses.goal
  }

  if (responses.name) {
    model.name = responses.name
  }

  if (responses.selfAssessment) {
    const selfConf = parseSelfAssessment(responses.selfAssessment)
    model.confidence = selfConf
    updateKnowledge(model, topic, {
      confidence: selfConf,
      level: model.currentLevel,
    })
  }

  if (responses.knownConcepts) {
    const concepts = responses.knownConcepts.split(",").map(c => c.trim()).filter(Boolean)
    for (const concept of concepts) {
      updateKnowledge(model, concept, {
        confidence: 60,
        level: model.currentLevel,
        bloomStage: "understand",
      })
    }
  }

  if (responses.priorExperience) {
    detectPriorExperienceMisconceptions(model, topic, responses.priorExperience)
  }

  saveStudentModel(model)
  return model
}

function normalizeLevel(raw: string): LearningLevel {
  const lower = raw.toLowerCase().trim()
  if (/beginner|new/.test(lower)) return "beginner"
  if (/foundation|basic/.test(lower)) return "foundation"
  if (/intermediate/.test(lower)) return "intermediate"
  if (/advanced/.test(lower)) return "advanced"
  if (/expert|master/.test(lower)) return "expert"
  return "beginner"
}

function parseSelfAssessment(raw: string): number {
  const lower = raw.toLowerCase().trim()
  if (/expert|master|10|9/.test(lower)) return 90
  if (/understand|comfortable|7|8/.test(lower)) return 70
  if (/basic|beginner|some|4|5|6/.test(lower)) return 45
  if (/zero|none|0|1|2|3/.test(lower)) return 15
  return 50
}

function detectPriorExperienceMisconceptions(
  model: StudentModel,
  topic: string,
  experience: string,
): void {
  const lower = experience.toLowerCase()

  const misconceptionPatterns: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /all.*same|no.*difference|identical/, description: "Assumes all concepts in this topic are identical" },
    { pattern: /not.*necessary|don'?t.*need|skip.*theory/, description: "Thinks certain fundamentals are unnecessary" },
    { pattern: /just.*code|skip.*to.*code/, description: "Prefers skipping theory to code directly" },
    { pattern: /already.*know.*everything|know.*it.*all/, description: "May overestimate understanding" },
  ]

  for (const { pattern, description } of misconceptionPatterns) {
    if (pattern.test(lower)) {
      const existing = model.misconceptions.find(
        m => m.topic === topic && m.description === description && !m.resolved,
      )
      if (!existing) {
        model.misconceptions.push({
          topic,
          description,
          detectedAt: new Date().toISOString(),
          resolved: false,
        })
      }
    }
  }
}

function buildNewStudentGreeting(topic: string): string {
  return `Welcome! I'll be your learning mentor for **${topic}**.

Before we start, I need to understand where you are. Let me ask a few quick questions:

1. What's your name?
2. What's your learning goal? (e.g., "get a backend job", "understand APIs", "build a portfolio project")
3. How would you rate your current knowledge of ${topic}?
   - "Zero — never touched it"
   - "Some basics — read/watched a few things"
   - "Comfortable — have built something small"
   - "Experienced — use it regularly"
4. Any prior experience with ${topic} or similar concepts?`
}

function buildReturningStudentGreeting(model: StudentModel, topic: string): string {
  const topicNode = model.knowledge[topic]
  const name = model.name || "there"

  if (topicNode) {
    const stars = renderStars(topicNode.competency.knowledge)
    return `Welcome back, **${name}**!

Last time we worked on **${topic}** — your current competency: ${stars}

Where you left off:
- Bloom stage: ${topicNode.bloomStage}
- Confidence: ${topicNode.confidence}%
- Practice count: ${topicNode.practiceCount}

Ready to continue, or want to start fresh on something new?`
  }

  return `Welcome back, **${name}**!

Your overall level: **${model.currentLevel}** (${model.confidence}% confidence)

I see you haven't worked on **${topic}** yet. Let's diagnose your starting point.`
}

function determineNextStep(model: StudentModel, topic: string): string {
  const topicNode = model.knowledge[topic]

  if (!topicNode) {
    return "diagnose"
  }

  if (topicNode.confidence < 30) {
    return "teach-fundamentals"
  }

  if (topicNode.bloomStage === "remember" || topicNode.bloomStage === "understand") {
    return "practice"
  }

  if (topicNode.bloomStage === "apply") {
    return "challenge"
  }

  if (topicNode.bloomStage === "analyze" || topicNode.bloomStage === "evaluate") {
    return "deepen"
  }

  return "create"
}

function getRecommendedStyle(model: StudentModel): string {
  const topicCount = Object.keys(model.knowledge).length
  if (topicCount === 0) return model.preferredStyle

  const avgConfidence =
    Object.values(model.knowledge).reduce((s, k) => s + k.confidence, 0) /
    topicCount

  if (avgConfidence < 30) return "example-first"
  if (avgConfidence < 60) return "concept-first"
  if (model.patterns.curiositySignals > model.patterns.frustrationSignals) {
    return "analogy-first"
  }
  return model.preferredStyle
}

function renderStars(score: number): string {
  if (score <= 0) return "☆☆☆☆☆"
  if (score < 20) return "★☆☆☆☆"
  if (score < 40) return "★★☆☆☆"
  if (score < 60) return "★★★☆☆"
  if (score < 80) return "★★★★☆"
  return "★★★★★"
}

export function generateDiagnosisQuestions(topic: string): Array<{
  question: string
  header: string
  options: Array<{ label: string; description: string }>
}> {
  return [
    {
      question: `How would you rate your current knowledge of ${topic}?`,
      header: "Self Assessment",
      options: [
        { label: "Zero", description: "Never touched it before" },
        { label: "Some basics", description: "Read or watched a few things" },
        { label: "Comfortable", description: "Built something small" },
        { label: "Experienced", description: "Use it regularly" },
      ],
    },
    {
      question: `What's your learning goal for ${topic}?`,
      header: "Learning Goal",
      options: [
        { label: "Get a job", description: "Need it for career" },
        { label: "Build something", description: "Have a project in mind" },
        { label: "Understand deeply", description: "Want mastery, not just basics" },
        { label: "Fix gaps", description: "Know some, but holes in knowledge" },
      ],
    },
  ]
}

export function buildInitialDiagnosisPrompt(topic: string): string {
  const questions = generateDiagnosisQuestions(topic)
  const lines: string[] = []
  lines.push(`Let's figure out where you stand with **${topic}**.`)
  lines.push("")
  lines.push("I'll ask a couple of questions to calibrate the right starting point for you.")
  lines.push("")
  lines.push("Use the `question` tool to present these questions interactively:")
  lines.push("")
  for (const q of questions) {
    lines.push(`**${q.header}**: ${q.question}`)
    for (const opt of q.options) {
      lines.push(`  - ${opt.label}: ${opt.description}`)
    }
    lines.push("")
  }
  lines.push("After the user answers, call `cs_diagnose_student` with their responses to update the student model.")
  return lines.join("\n")
}
