import type { CoachIntent, CoachChoice, ProgressData } from "./utils/types"
import { detectIntent, choicePrompt, prerequisiteGateMessage, bloomStagePrompt } from "./utils/templates"
import { readProfile, getLatestSessionDate, isProfileExists } from "./utils/paths"
import { isFileExists, readJson } from "./utils/fs"
import { join } from "path"

export interface CoachContext {
  projectDir: string
}

export interface CoachResponse {
  message: string
  shouldPromptChoice?: boolean
  intent: CoachIntent
}

export function createCoachContext(projectDir: string): CoachContext {
  return { projectDir }
}

export function handleGreeting(ctx: CoachContext): CoachResponse {
  if (!isProfileExists(ctx.projectDir)) {
    return { message: "", intent: "greeting" }
  }
  const profile = readProfile(ctx.projectDir)
  const latestSession = getLatestSessionDate(ctx.projectDir)
  if (latestSession) {
    return {
      message: `Halo! Senang bertemu lagi.\n\nTerakhir kamu belajar di sesi ${latestSession}.\nIngin melanjutkan atau mulai topik baru?`,
      intent: "greeting",
    }
  }
  return {
    message: `Halo! Terakhir kita belajar bersama.\nAda yang ingin kamu tanyakan atau pelajari hari ini?`,
    intent: "greeting",
  }
}

export function handleLearnTopic(ctx: CoachContext, topic: string): CoachResponse {
  return {
    message: contextEstimation(topic),
    shouldPromptChoice: true,
    intent: "learn-topic",
  }
}

export function handleQuestionRoadmap(
  ctx: CoachContext,
  topic: string,
  askedItem: string,
): CoachResponse {
  const progress = readJson<ProgressData>(
    progressPath(ctx.projectDir),
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )

  const activeTopic = Object.keys(progress.topics).find(
    t => progress.topics[t].percent > 0 && progress.topics[t].percent < 100,
  )

  if (activeTopic) {
    const plan = progress.topics[activeTopic]
    if (!plan.practice.includes(askedItem) && !plan.theory.includes(askedItem)) {
      return {
        message: `Saya lihat di learning plan kamu, saat ini sedang fokus di **${activeTopic}**.\n\n"${askedItem}" tidak ada dalam roadmap aktifmu. Sesuai rencana, langkah selanjutnya adalah:\n- ${plan.theory.filter(t => !plan.theory.includes(t)).join("\n- ")}\n\nTetap fokus pada rencana yang sudah dibuat ya.`,
        intent: "question-roadmap",
      }
    }
    return {
      message: `Ya, "${askedItem}" ada di roadmap **${activeTopic}** kamu. Silakan kerjakan sesuai plan. Setelah selesai, beri tahu saya untuk review.`,
      intent: "question-roadmap",
    }
  }

  return {
    message: `Kamu belum memiliki roadmap aktif. Ingin saya buatkan learning plan untukmu?`,
    intent: "question-roadmap",
  }
}

export function handlePrerequisiteQuestion(
  ctx: CoachContext,
  askedTopic: string,
): CoachResponse {
  const missing = findMissingPrerequisite(ctx, askedTopic)
  if (missing) {
    return {
      message: prerequisiteGateMessage(askedTopic, missing),
      intent: "question-prerequisite",
    }
  }
  return {
    message: `Bagus! Sepertinya kamu sudah siap belajar ${askedTopic}.\n\n${bloomStagePrompt("remember", askedTopic)}`,
    intent: "question-prerequisite",
  }
}

export function handleAchievement(ctx: CoachContext, topic: string): CoachResponse {
  return {
    message: `Selamat! Pemahaman yang baik.\n\nSaya akan catat progres kamu. Lanjut ke tantangan berikutnya atau review dulu?`,
    intent: "achievement",
  }
}

export function handleResume(ctx: CoachContext): CoachResponse {
  const latestDate = getLatestSessionDate(ctx.projectDir)
  if (!latestDate) {
    return {
      message: `Tidak ada sesi sebelumnya. Mulai belajar baru? Ceritakan topik yang ingin kamu pelajari.`,
      intent: "resume",
    }
  }
  return {
    message: `Checkpoint terakhir: sesi **${latestDate}**.`,
    intent: "resume",
  }
}

export function processCoachingChoice(choice: CoachChoice): CoachResponse {
  if (choice === "A") {
    return {
      message: "Baik, saya akan bantu selesaikan pekerjaan kamu. Ceritakan apa yang perlu dikerjakan.",
      intent: "complete-task",
    }
  }
  return {
    message: "Baik! Mari kita mulai perjalanan belajar. Topik apa yang ingin kamu pelajari?",
    intent: "learn-topic",
  }
}

function contextEstimation(topic: string): string {
  return `Saya akan menjadi mentor Anda.

Topik:
✔ ${topic}

Estimasi kebutuhan konteks:

  Beginner    ≈ 25k context
  Intermediate ≈ 80k context
  Expert      ≈ 250k context

Pilih level untuk memulai.`
}

function progressPath(projectDir: string): string {
  return join(projectDir, ".codingschool", "progress.json")
}

function findMissingPrerequisite(ctx: CoachContext, topic: string): string | null {
  return null
}
