import type { CoachIntent, BloomStage } from "./types"

export function detectIntent(message: string): CoachIntent {
  const lower = message.toLowerCase().trim()
  if (!lower) return "unknown"

  if (/^(hi|hello|hey)\b/.test(lower)) {
    return "greeting"
  }

  if (/^(ok|okay|alright|got it|understood|i understand|i see)\b/.test(lower)) {
    return "achievement"
  }

  if (/^(finish|complete|work on|help me)\b/.test(lower)) {
    return "complete-task"
  }

  if (/^(i want|i wanna|i would like|want|wanna)\s+(to\s+)?(learn|study|understand|master)/.test(lower)) {
    return "learn-topic"
  }

  if (/^(progress|status|how far|dashboard)\b/.test(lower)) {
    return "status-check"
  }

  if (/^(continue|resume|ready|next|let's go|proceed)\b/.test(lower)) {
    return "resume"
  }

  if (/^(should|must|do i need|is it necessary)\b/.test(lower)) {
    return "question-roadmap"
  }

  if (/^(how|what is|explain|why|when)\b/.test(lower)) {
    return "question-prerequisite"
  }

  if (/^(learn|understand|i get it)\b/.test(lower)) {
    return "learn-topic"
  }

  if (/^(i|we)\s+(finished|completed|succeeded|done|managed|successfully)/.test(lower)) {
    return "achievement"
  }

  return "unknown"
}

export function onboardingMessage(): string {
  return `Hi! I'm your CodingSchool mentor.

I will help you learn software engineering the right way — not just generate code.

Tell me your learning goal or the topic you want to study.
I will create a learning plan tailored for you.`
}

export function choicePrompt(): string {
  return `What would you like to do:

A. Complete the task

or

B. Build your skills?`
}

export function contextEstimation(topic: string): string {
  return `I will be your mentor.

Topic:
✔ ${topic}

Estimated context needed:

  Beginner    ≈ 25k context
  Intermediate ≈ 80k context
  Expert      ≈ 250k context

Pick a level to start.`
}

export function bloomStagePrompt(stage: BloomStage, topic: string): string {
  const prompts: Record<BloomStage, string> = {
    remember: `What do you understand about ${topic}?`,
    understand: `Why is ${topic} used? Explain in your own words.`,
    apply: `Implement ${topic} in code.`,
    analyze: `What are the limitations or trade-offs of ${topic}?`,
    evaluate: `Compare ${topic} with alternative approaches. Which is better and why?`,
    create: `Build a simple application that uses ${topic}.`,
  }
  return prompts[stage]
}

export function prerequisiteGateMessage(
  askedTopic: string,
  missingTopic: string,
): string {
  return `I will not explain ${askedTopic} right now.

Please complete **${missingTopic}** first.

Because ${askedTopic} will be much easier to understand after you master ${missingTopic}.`
}
