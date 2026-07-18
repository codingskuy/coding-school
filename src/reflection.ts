import type { StudentModel, BloomStage, SessionSummary } from "./utils/types"
import { loadStudentModel, saveStudentModel } from "./student-model"

export interface ReflectionPrompt {
  type: "end-of-session" | "after-challenge" | "misconception-check" | "progress-review"
  topic: string
  prompt: string
  followUp: string
}

export interface SessionReflection {
  summary: string
  insights: string[]
  misconceptionsDetected: string[]
  progressNote: string
  nextSessionPlan: string
  encouragement: string
}

export function generateReflectionPrompt(
  type: ReflectionPrompt["type"],
  topic: string,
  bloomStage?: BloomStage,
): ReflectionPrompt {
  switch (type) {
    case "end-of-session":
      return endOfSessionReflection(topic)
    case "after-challenge":
      return afterChallengeReflection(topic, bloomStage)
    case "misconception-check":
      return misconceptionCheckReflection(topic)
    case "progress-review":
      return progressReviewReflection(topic)
  }
}

function endOfSessionReflection(topic: string): ReflectionPrompt {
  return {
    type: "end-of-session",
    topic,
    prompt: `Let's wrap up today's session on **${topic}**.

Before we finish, I'd like you to reflect on what you learned:

1. **What's one thing you understand now that you didn't before?**
2. **What's still confusing or fuzzy?**
3. **What would you like to practice more next time?**

Take your time — even a short answer helps me adjust your learning path.`,
    followUp: "Great reflection! Based on what you said, here's what I'm noting for your next session...",
  }
}

function afterChallengeReflection(
  topic: string,
  bloomStage?: BloomStage,
): ReflectionPrompt {
  const stageSpecific: Record<BloomStage, string> = {
    remember: "Can you recall the key terms and definitions from this exercise?",
    understand: "Can you explain the concept in your own words?",
    apply: "How would you use this in a different project or context?",
    analyze: "What are the differences between this approach and alternatives?",
    evaluate: "Why is this solution better or worse than other approaches?",
    create: "How would you extend or improve this solution?",
  }

  const question = bloomStage ? stageSpecific[bloomStage] : "What did you learn from this?"

  return {
    type: "after-challenge",
    topic,
    prompt: `Nice work on that challenge! Let's reflect:

**${question}**

Think about it for a moment, then share your thoughts.`,
    followUp: "Good thinking! Let me update your competency based on how you did.",
  }
}

function misconceptionCheckReflection(topic: string): ReflectionPrompt {
  return {
    type: "misconception-check",
    topic,
    prompt: `I noticed something I want to check with you.

Sometimes when learning **${topic}**, students develop certain misconceptions. Let me ask:

1. **Do you think [concept A] and [concept B] are the same thing?** (They're not — here's why...)
2. **Do you think [concept] is always necessary/unnecessary?** (It depends on...)
3. **Do you prefer to skip theory and just code?** (That's understandable, but here's why theory matters for ${topic}...)

Which of these resonates with you? Or share a different confusion you have.`,
    followUp: "Thanks for being honest about your confusion. That's actually the fastest way to learn.",
  }
}

function progressReviewReflection(topic: string): ReflectionPrompt {
  return {
    type: "progress-review",
    topic,
    prompt: `Let's review your progress on **${topic}**:

**Current Status:**
- Your competency in this topic
- How your understanding has grown
- What concepts you've mastered vs. what needs work

Take a moment to look at your progress dashboard. What stands out to you?

What do you want to focus on next?`,
    followUp: "Based on your reflection, here's what I recommend for your next session.",
  }
}

export function extractInsights(reflectionText: string): string[] {
  const insights: string[] = []
  const lower = reflectionText.toLowerCase()

  const patterns: Array<{ pattern: RegExp; insight: string }> = [
    { pattern: /don'?t understand|confused|unclear/, insight: "Student expresses confusion — needs scaffolding" },
    { pattern: /got it|understand|makes sense|clear/, insight: "Student expresses understanding — ready for challenge" },
    { pattern: /practice|try|implement|code/, insight: "Student wants hands-on practice — prioritize exercises" },
    { pattern: /why|explain|reason|because/, insight: "Student seeking deeper understanding — explain rationale" },
    { pattern: /same|similar|different|compare/, insight: "Student thinking comparatively — use comparison exercises" },
    { pattern: /real|project|actual|build/, insight: "Student wants practical application — use real-world examples" },
    { pattern: /boring|easy|basic|simple/, insight: "Student finds material too easy — increase difficulty" },
    { pattern: /hard|difficult|struggle|too much/, insight: "Student overwhelmed — reduce scope, add scaffolding" },
  ]

  for (const { pattern, insight } of patterns) {
    if (pattern.test(lower)) {
      insights.push(insight)
    }
  }

  return insights
}

export function detectMisconceptionsFromReflection(
  topic: string,
  reflectionText: string,
): Array<{ description: string; severity: "critical" | "warning" | "info" }> {
  const misconceptions: Array<{ description: string; severity: "critical" | "warning" | "info" }> = []
  const lower = reflectionText.toLowerCase()

  const misconceptionPatterns: Array<{
    pattern: RegExp
    description: string
    severity: "critical" | "warning" | "info"
  }> = [
    {
      pattern: /semua.*sama|identik|gak.*beda|all.*same|no.*difference|all.*identical/,
      description: "Cannot distinguish between related concepts",
      severity: "critical",
    },
    {
      pattern: /tidak.*penting|gak.*perlu|not.*important|skip.*theory|don'?t.*need/,
      description: "Dismisses important fundamentals",
      severity: "warning",
    },
    {
      pattern: /selalu.*benar|tidak.*pernah.*salah|always.*right|never.*wrong|never.*mistake/,
      description: "Overconfident — doesn't recognize edge cases",
      severity: "warning",
    },
    {
      pattern: /hafal|rumus|template|memorize|just.*remember|rote/,
      description: "Relies on memorization rather than understanding",
      severity: "warning",
    },
    {
      pattern: /bingung.*kapan|tidak.*tahu.*kapan|when.*to.*use|don'?t.*know.*when/,
      description: "Unsure when to apply concepts",
      severity: "info",
    },
  ]

  for (const { pattern, description, severity } of misconceptionPatterns) {
    if (pattern.test(lower)) {
      misconceptions.push({ description, severity })
    }
  }

  return misconceptions
}

export function processSessionReflection(
  topic: string,
  reflectionText: string,
  studentModel: StudentModel,
): SessionReflection {
  const insights = extractInsights(reflectionText)
  const misconceptions = detectMisconceptionsFromReflection(topic, reflectionText)

  for (const mc of misconceptions) {
    const existing = studentModel.misconceptions.find(
      m => m.topic === topic && m.description === mc.description && !m.resolved,
    )
    if (!existing) {
      studentModel.misconceptions.push({
        topic,
        description: mc.description,
        severity: mc.severity,
        detectedAt: new Date().toISOString(),
        resolved: false,
      })
    }
  }

  const progressNote = buildProgressNote(insights, misconceptions)
  const nextSessionPlan = buildNextSessionPlan(topic, insights, misconceptions)
  const encouragement = buildEncouragement(insights, misconceptions)

  saveStudentModel(studentModel)

  return {
    summary: buildSummary(topic, insights, misconceptions),
    insights: insights,
    misconceptionsDetected: misconceptions.map(m => m.description),
    progressNote,
    nextSessionPlan,
    encouragement,
  }
}

function buildSummary(
  topic: string,
  insights: string[],
  misconceptions: Array<{ description: string; severity: string }>,
): string {
  const lines: string[] = []
  lines.push(`Session summary for **${topic}**:`)
  lines.push("")
  if (insights.length > 0) {
    lines.push(`- **${insights.length} insight(s)** captured from your reflection`)
  }
  if (misconceptions.length > 0) {
    lines.push(`- **${misconceptions.length} potential misconception(s)** detected`)
    for (const mc of misconceptions) {
      lines.push(`  - (${mc.severity}) ${mc.description}`)
    }
  }
  if (insights.length === 0 && misconceptions.length === 0) {
    lines.push("- No specific insights or misconceptions detected from this reflection")
  }
  return lines.join("\n")
}

function buildProgressNote(
  insights: string[],
  misconceptions: Array<{ description: string; severity: string }>,
): string {
  if (misconceptions.length > 0) {
    return "Needs review on concepts where misconceptions were detected. Will revisit fundamentals next session."
  }
  if (insights.length > 2) {
    return "Strong engagement — student is connecting concepts well. Ready for more challenging material."
  }
  return "Steady progress. Continue at current pace."
}

function buildNextSessionPlan(
  topic: string,
  insights: string[],
  misconceptions: Array<{ description: string; severity: string }>,
): string {
  const lines: string[] = []
  lines.push("**Next session plan:**")
  lines.push("")

  if (misconceptions.length > 0) {
    lines.push(`1. Address misconceptions: ${misconceptions.map(m => m.description).join(", ")}`)
    lines.push("2. Reinforce correct understanding with targeted exercises")
    lines.push("3. Re-check understanding with a quick quiz")
  } else if (insights.some(i => i.includes("practice"))) {
    lines.push("1. Start with a hands-on challenge based on today's topic")
    lines.push("2. Gradually increase complexity")
    lines.push("3. End with a reflection on what worked")
  } else {
    lines.push("1. Quick review of today's key concepts")
    lines.push("2. Introduce the next concept in the learning path")
    lines.push("3. Practice exercise with scaffolding as needed")
  }

  return lines.join("\n")
}

function buildEncouragement(
  insights: string[],
  misconceptions: Array<{ description: string; severity: string }>,
): string {
  if (misconceptions.length > 0 && misconceptions.some(m => m.severity === "critical")) {
    return "You're doing great by being honest about your confusion. Every misconception you identify is one step closer to mastery. Let's tackle this together next time."
  }
  if (insights.length > 2) {
    return "Excellent session! You're making real connections between concepts. Keep up that curiosity — it's your superpower."
  }
  if (insights.some(i => i.includes("practice"))) {
    return "Love that you want to practice more. That's exactly the right mindset. See you next session!"
  }
  return "Every session is progress. Even small steps compound over time. Keep going!"
}
