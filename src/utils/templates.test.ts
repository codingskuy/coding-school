import { describe, it, expect } from "bun:test"
import {
  detectIntent,
  onboardingMessage,
  choicePrompt,
  contextEstimation,
  bloomStagePrompt,
  prerequisiteGateMessage,
} from "./templates"

describe("detectIntent", () => {
  it("detects greeting", () => {
    expect(detectIntent("hi")).toBe("greeting")
    expect(detectIntent("hello")).toBe("greeting")
    expect(detectIntent("hey there")).toBe("greeting")
  })

  it("detects learn-topic", () => {
    expect(detectIntent("i want to learn Rust")).toBe("learn-topic")
    expect(detectIntent("i wanna study dart")).toBe("learn-topic")
    expect(detectIntent("i would like to understand generics")).toBe("learn-topic")
    expect(detectIntent("learn typescript")).toBe("learn-topic")
  })

  it("detects achievement", () => {
    expect(detectIntent("ok")).toBe("achievement")
    expect(detectIntent("got it")).toBe("achievement")
    expect(detectIntent("i understand")).toBe("achievement")
    expect(detectIntent("i see")).toBe("achievement")
  })

  it("detects resume/continue", () => {
    expect(detectIntent("continue")).toBe("resume")
    expect(detectIntent("resume")).toBe("resume")
    expect(detectIntent("ready")).toBe("resume")
    expect(detectIntent("next")).toBe("resume")
  })

  it("detects question-roadmap", () => {
    expect(detectIntent("should I learn sorting first")).toBe("question-roadmap")
    expect(detectIntent("do i need to know math")).toBe("question-roadmap")
  })

  it("detects question-prerequisite", () => {
    expect(detectIntent("how does binary search work")).toBe("question-prerequisite")
    expect(detectIntent("what is a linked list")).toBe("question-prerequisite")
    expect(detectIntent("explain recursion")).toBe("question-prerequisite")
    expect(detectIntent("why use generics")).toBe("question-prerequisite")
  })

  it("detects complete-task", () => {
    expect(detectIntent("finish the task")).toBe("complete-task")
    expect(detectIntent("complete the work")).toBe("complete-task")
  })

  it("detects status-check", () => {
    expect(detectIntent("progress")).toBe("status-check")
    expect(detectIntent("status")).toBe("status-check")
    expect(detectIntent("how far")).toBe("status-check")
    expect(detectIntent("dashboard")).toBe("status-check")
  })

  it("returns unknown for gibberish", () => {
    expect(detectIntent("asdfghjkl")).toBe("unknown")
    expect(detectIntent("   ")).toBe("unknown")
  })

  it("is case insensitive", () => {
    expect(detectIntent("HELLO")).toBe("greeting")
    expect(detectIntent("I WANT TO LEARN DART")).toBe("learn-topic")
  })
})

describe("onboardingMessage", () => {
  it("returns a non-empty string", () => {
    const msg = onboardingMessage()
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).toContain("CodingSchool")
  })
})

describe("choicePrompt", () => {
  it("contains A and B options", () => {
    const prompt = choicePrompt()
    expect(prompt).toContain("A.")
    expect(prompt).toContain("B.")
  })
})

describe("contextEstimation", () => {
  it("includes the topic", () => {
    const msg = contextEstimation("Rust")
    expect(msg).toContain("Rust")
  })

  it("includes all three levels", () => {
    const msg = contextEstimation("Go")
    expect(msg).toContain("Beginner")
    expect(msg).toContain("Intermediate")
    expect(msg).toContain("Expert")
  })
})

describe("bloomStagePrompt", () => {
  const stages = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const

  for (const stage of stages) {
    it(`returns a prompt for stage "${stage}"`, () => {
      const prompt = bloomStagePrompt(stage, "Rust")
      expect(prompt.length).toBeGreaterThan(0)
      expect(prompt).toContain("Rust")
    })
  }
})

describe("prerequisiteGateMessage", () => {
  it("mentions both topics", () => {
    const msg = prerequisiteGateMessage("Binary Search", "Sorting")
    expect(msg).toContain("Binary Search")
    expect(msg).toContain("Sorting")
  })
})
