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

Ask the user what topic they want to learn or the goal they want to achieve.
Use the "question" tool to ask, so they can type their answer or choose a suggestion.`
}

export function choicePrompt(): string {
  return `Ask the user what they want to do. Use the "question" tool with options:
- Complete the task
- Build your skills`
}

export function contextEstimation(topic: string): string {
  return `I will be your mentor.

Topic: ${topic}

Estimated context needed:
  Beginner    ≈ 25k context
  Intermediate ≈ 80k context
  Expert      ≈ 250k context

Ask the user to pick a level. Use the "question" tool with options: Beginner, Intermediate, Expert.`
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
