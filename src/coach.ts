import type { CoachIntent, CoachChoice, ProgressData } from "./utils/types"
import { prerequisiteGateMessage, bloomStagePrompt, contextEstimation } from "./utils/templates"
import { getLatestSessionDate, isProfileExists, topicRoadmapPath, roadmapTopicsList } from "./utils/paths"
import { readJson } from "./utils/fs"
import { join } from "path"
import { existsSync, readFileSync } from "fs"

export interface CoachContext {
  projectDir: string
}

export interface CoachResponse {
  message: string
  shouldPromptChoice?: boolean
  intent: CoachIntent
  topic?: string
}

export function createCoachContext(projectDir: string): CoachContext {
  return { projectDir }
}

export function handleGreeting(ctx: CoachContext): CoachResponse {
  if (!isProfileExists(ctx.projectDir)) {
    return { message: "", intent: "greeting" }
  }
  const latestSession = getLatestSessionDate(ctx.projectDir)
  if (latestSession) {
    return {
      message: `Welcome back! Your last session was on ${latestSession}.\nWould you like to continue or start a new topic?`,
      intent: "greeting",
    }
  }
  return {
    message: `Good to see you again!\nAnything you'd like to learn or ask today?`,
    intent: "greeting",
  }
}

export function handleLearnTopic(topic: string): CoachResponse {
  return {
    message: contextEstimation(topic),
    shouldPromptChoice: true,
    intent: "learn-topic",
    topic,
  }
}

export function handleQuestionRoadmap(
  projectDir: string,
  topic: string,
  askedItem: string,
): CoachResponse {
  const progress = readJson<ProgressData>(
    progressPath(projectDir),
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )

  const activeTopic = Object.keys(progress.topics).find(
    t => progress.topics[t].percent > 0 && progress.topics[t].percent < 100,
  )

  if (activeTopic) {
    const plan = progress.topics[activeTopic]
    if (!plan.practice.includes(askedItem) && !plan.theory.includes(askedItem)) {
      const items = [...plan.theory, ...plan.practice]
      return {
        message: `I see you're currently focused on **${activeTopic}**.\n\n"${askedItem}" is not in your active roadmap. Your next planned steps are:\n- ${items.join("\n- ")}\n\nStay focused on the current plan.`,
        intent: "question-roadmap",
      }
    }
    return {
      message: `Yes, "${askedItem}" is in your **${activeTopic}** roadmap. Go ahead and work on it. Let me know when you're done so I can review.`,
      intent: "question-roadmap",
    }
  }

  return {
    message: `You don't have an active roadmap yet. Would you like me to create a learning plan for you?`,
    intent: "question-roadmap",
  }
}

export function handlePrerequisiteQuestion(
  projectDir: string,
  askedTopic: string,
): CoachResponse {
  const missing = findMissingPrerequisite(getProgress(projectDir), askedTopic)
  if (missing) {
    return {
      message: prerequisiteGateMessage(askedTopic, missing),
      intent: "question-prerequisite",
    }
  }
  return {
    message: `Great! You seem ready to learn ${askedTopic}.\n\n${bloomStagePrompt("remember", askedTopic)}`,
    intent: "question-prerequisite",
  }
}

export function handleAchievement(topic: string): CoachResponse {
  return {
    message: `Well done! That's solid understanding.\n\nI'll log your progress. Ready for the next challenge or want to review first?`,
    intent: "achievement",
  }
}

export function handleResume(projectDir: string): CoachResponse {
  const latestDate = getLatestSessionDate(projectDir)
  if (!latestDate) {
    return {
      message: `No previous sessions found. Start a new learning journey? Tell me a topic you'd like to study.`,
      intent: "resume",
    }
  }
  return {
    message: `Last checkpoint: session **${latestDate}**.`,
    intent: "resume",
  }
}

export function handleStatusCheck(projectDir: string): CoachResponse {
  const progress = getProgress(projectDir)
  const topicCount = Object.keys(progress.topics).length
  if (topicCount === 0) {
    return {
      message: `You haven't started any topics yet. Tell me what you'd like to learn!`,
      intent: "status-check",
    }
  }
  const lines = Object.entries(progress.topics).map(([k, t]) =>
    `- **${k}**: ${t.percent}% complete`
  )
  return {
    message: `Here's your learning progress:\n${lines.join("\n")}\n\nXP: ${progress.xp} | Level: ${progress.level}`,
    intent: "status-check",
  }
}

export function processCoachingChoice(choice: CoachChoice): CoachResponse {
  if (choice === "A") {
    return {
      message: "Alright, I'll help you get the task done. Tell me what needs to be done.",
      intent: "complete-task",
    }
  }
  return {
    message: "Great! Let's start your learning journey. What topic would you like to study?",
    intent: "learn-topic",
  }
}

function findMissingPrerequisite(
  progress: ProgressData,
  askedTopic: string,
): string | null {
  const roadmapTopics = Object.keys(progress.topics)
  if (roadmapTopics.length === 0) return null

  const incomplete = roadmapTopics.find(t => progress.topics[t].percent < 100)
  if (incomplete && incomplete !== askedTopic) {
    return incomplete
  }
  return null
}

function getProgress(projectDir: string): ProgressData {
  return readJson<ProgressData>(
    progressPath(projectDir),
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )
}

function progressPath(projectDir: string): string {
  return join(projectDir, ".codingschool", "progress.json")
}
