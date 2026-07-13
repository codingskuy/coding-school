import { writeMarkdown, ensureDir, readJson, writeJson } from "../utils/fs"
import { roadmapDir, topicRoadmapPath } from "../utils/paths"
import type { ProgressData } from "../utils/types"
import { join } from "path"

export interface CreateRoadmapOptions {
  projectDir: string
  topic: string
  level: "beginner" | "intermediate" | "expert"
}

const THEORY_TEMPLATES: Record<string, Record<string, string[]>> = {
  rust: {
    beginner: [
      "Variables & Mutability",
      "Data Types (i32, f64, bool, char, String, &str, Vec, HashMap)",
      "Ownership & Borrowing",
      "Struct & Enum",
      "Pattern Matching",
      "Error Handling (Result, Option, panic!, unwrap, ?)",
    ],
    intermediate: [
      "Generic Types & Traits",
      "Lifetimes & Elision Rules",
      "Closures & Iterators",
      "Smart Pointers (Box, Rc, RefCell)",
      "Concurrency (thread, channel, Arc, Mutex)",
    ],
    expert: [
      "Unsafe Rust",
      "FFI (Foreign Function Interface)",
      "Macros (declarative & procedural)",
      "Pin & Unpin",
      "Async/Await internals & Future trait",
      "Custom Allocators",
    ],
  },
  dart: {
    beginner: [
      "Variables & Data Types",
      "Control Flow (if, for, while, switch)",
      "Collections (List, Set, Map, Queue)",
      "Function & Named Parameters",
      "Class & Constructor",
      "Null Safety",
    ],
    intermediate: [
      "Generics",
      "Async/Await & Future",
      "Streams",
      "Mixins & Extensions",
      "Error Handling (try/catch, Result)",
    ],
    expert: [
      "Isolates & Concurrency",
      "Metaprogramming (code generation, annotations)",
      "FFI with C",
      "Custom lint rules & analyzer plugins",
      "Dart VM internals",
    ],
  },
  flutter: {
    beginner: [
      "Widget Tree & BuildContext",
      "StatelessWidget vs StatefulWidget",
      "Layout Widgets (Row, Column, Stack, Flex, Expanded, Padding, Container)",
      "State Management (setState, lifted state)",
      "Navigation & Routing",
      "User Input (TextField, Form, Button)",
    ],
    intermediate: [
      "StreamBuilder & FutureBuilder",
      "Provider & Riverpod",
      "BLoC Pattern",
      "Animation & CustomPainter",
      "HTTP Client & REST API integration",
      "Local Storage (SharedPreferences, Hive)",
    ],
    expert: [
      "Custom RenderObject",
      "Platform Channels (MethodChannel, EventChannel, Pigeon)",
      "Flutter Engine internals (Skia/Impeller, Dart VM, text rendering)",
      "Custom Font & typography engine",
      "Performance profiling & Flame chart analysis",
      "Widget testing & integration testing strategies",
    ],
  },
  git: {
    beginner: [
      "Repository Init & Clone",
      "Commit, Diff, Log",
      "Branch & Merge",
      "Remote: Push, Pull, Fetch",
      "Undoing Changes (reset, revert, restore)",
    ],
    intermediate: [
      "Rebase vs Merge",
      "Cherry-pick & Stash",
      "Conflict Resolution Strategies",
      "Git Hooks",
      "Tagging & Releases",
    ],
    expert: [
      "Git Internals (objects, refs, packfiles)",
      "Bisect & Advanced Debugging",
      "Submodules & Subtrees",
      "Custom Git Commands & Aliases",
      "Performance Tuning (bitmap, partial clone)",
    ],
  },
  architecture: {
    beginner: [
      "What is Software Architecture?",
      "Layered Architecture",
      "Client-Server Model",
      "Monolith vs Microservices",
      "API Design Basics (REST)",
    ],
    intermediate: [
      "Domain-Driven Design",
      "Event-Driven Architecture",
      "CQRS & Event Sourcing",
      "Hexagonal Architecture",
      "Message Queues & Pub/Sub",
    ],
    expert: [
      "Architecture Decision Records (ADR)",
      "Scalability Patterns (sharding, replication)",
      "Chaos Engineering",
      "Distributed Transactions & Sagas",
      "Evolutionary Architecture",
    ],
  },
  testing: {
    beginner: [
      "Unit Testing Principles",
      "Test Pyramid",
      "Assertions & Matchers",
      "Test Doubles (mock, stub, fake)",
      "Test-Driven Development (TDD)",
    ],
    intermediate: [
      "Integration Testing",
      "Property-Based Testing",
      "Behavior-Driven Development (BDD)",
      "Code Coverage & Mutation Testing",
      "E2E Testing",
    ],
    expert: [
      "Testing in Production (canary, feature flags)",
      "Performance & Load Testing",
      "Chaos Testing",
      "Test Infrastructure (CI pipelines, containers)",
      "Contract Testing (Pact, Spring Cloud Contract)",
    ],
  },
  default: {
    beginner: [
      "Fundamental Concepts",
      "Basic Syntax & Types",
      "Control Flow",
      "Functions & Scope",
      "Data Structures",
    ],
    intermediate: [
      "Advanced Patterns",
      "Error Handling",
      "Asynchronous Programming",
      "Testing",
      "Performance Basics",
    ],
    expert: [
      "Internals & Architecture",
      "Optimization Techniques",
      "Advanced Tooling",
      "Production Readiness",
      "Contribution & Ecosystem",
    ],
  },
}

const PRACTICE_TEMPLATES: Record<string, Record<string, string[]>> = {
  default: {
    beginner: ["Basic Implementation", "Simple Exercise", "Guided Tutorial"],
    intermediate: ["Real-world Application", "API Integration", "Mini Project"],
    expert: ["Full Project", "Performance Optimization", "Library/Module Creation"],
  },
}

function getTemplates(topic: string, level: string): { theory: string[]; practice: string[] } {
  const topicLower = topic.toLowerCase()

  const topicTheory = THEORY_TEMPLATES[topicLower]
  const theory = topicTheory?.[level] ?? THEORY_TEMPLATES.default[level]

  const topicPractice = PRACTICE_TEMPLATES[topicLower]

  let practice: string[]
  if (topicPractice?.[level]) {
    practice = topicPractice[level]
  } else {
    const genericName = topic.includes(" ") ? topic.split(" ").slice(0, 2).join(" ") : topic
    practice = [
      `${genericName} Basic Implementation`,
      `${genericName} Exercise`,
    ]
    if (level !== "beginner") {
      practice.push(`${genericName} Real-world Application`)
    }
    if (level === "expert") {
      practice.push(`${genericName} Performance Tuning`)
    }
  }

  return { theory, practice }
}

export function generateLearningContract(options: CreateRoadmapOptions): string {
  const { topic, level } = options
  const title = `${topic} — ${level.charAt(0).toUpperCase() + level.slice(1)}`

  const { theory, practice } = getTemplates(topic, level)

  return `# ${title}

Status: 🟨 In Progress

---

## Target
Able to use and understand ${topic} at ${level} level.

---

## Theory
${theory.map(t => `- [ ] ${t}`).join("\n")}

---

## Practice
${practice.map(p => `- [ ] ${p}`).join("\n")}

---

## Quiz
- [ ] Quiz 1 — ${topic} fundamentals
- [ ] Quiz 2 — ${topic} ${level} concepts

---

## Final Project
- [ ] ${topic} ${level} Project

---

Progress: 0%
`
}

export function createRoadmap(options: CreateRoadmapOptions): string {
  const { projectDir, topic, level } = options

  ensureDir(roadmapDir(projectDir))
  const path = topicRoadmapPath(projectDir, topic.toLowerCase(), level)
  const content = generateLearningContract(options)
  writeMarkdown(path, content)

  const progress = readJson<ProgressData>(
    join(projectDir, ".codingschool", "progress.json"),
    { topics: {}, global: { softwareEngineering: 0, knowledge: 0, practice: 0, architecture: 0 }, xp: 0, level: 1 },
  )

  if (!progress.topics[topic]) {
    const { theory, practice } = getTemplates(topic, level)
    progress.topics[topic] = {
      name: topic,
      percent: 0,
      theory,
      practice,
      quizzes: [`Quiz 1 — ${topic} fundamentals`, `Quiz 2 — ${topic} ${level} concepts`],
      completedTheory: [],
      completedPractice: [],
      currentBloomStage: null,
    }
  }

  writeJson(join(projectDir, ".codingschool", "progress.json"), progress)

  return path
}
