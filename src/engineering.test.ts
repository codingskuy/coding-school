import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import {
  reviewCode,
  assessArchitecture,
  scanGRC,
  generateMentoringPlan,
  updateEngineeringFromReview,
} from "./engineering"
import { existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"

const TEST_DIR = join(import.meta.dir, "..", ".test-engineering")

beforeEach(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true })
  process.env.HOME = TEST_DIR
  const modelDir = join(TEST_DIR, ".config", "opencode", "codingschool")
  if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe("reviewCode", () => {
  test("returns score and feedback for clean code", () => {
    const code = `// Calculate total
function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0)
}`
    const result = reviewCode(TEST_DIR, code)
    expect(result.score).toBeGreaterThan(0)
    expect(result.strengths.length).toBeGreaterThan(0)
  })

  test("flags secrets in code", () => {
    const code = `const apiKey = "sk-1234567890abcdef"`
    const result = reviewCode(TEST_DIR, code)
    expect(result.grcFlags.some(f => f.includes("secrets"))).toBe(true)
  })

  test("flags console.log statements", () => {
    const code = `console.log("debug")`
    const result = reviewCode(TEST_DIR, code)
    expect(result.improvements.some(i => i.includes("Console.log"))).toBe(true)
  })

  test("flags magic numbers", () => {
    const code = `if (retries > 42) { throw new Error("too many") }`
    const result = reviewCode(TEST_DIR, code)
    expect(result.improvements.some(i => i.includes("Magic") || i.includes("constant"))).toBe(true)
  })

  test("praises error handling", () => {
    const code = `try {
  doSomething()
} catch (error) {
  handleError(error)
}`
    const result = reviewCode(TEST_DIR, code)
    expect(result.strengths.some(s => s.includes("error handling"))).toBe(true)
  })

  test("praises type annotations", () => {
    const code = `function greet(name: string): void {
  console.log(name)
}`
    const result = reviewCode(TEST_DIR, code)
    expect(result.strengths.some(s => s.includes("type annotations"))).toBe(true)
  })

  test("flags long lines", () => {
    const code = `const x = "this is a very long line that exceeds the maximum character limit of one hundred and twenty characters which is the recommended maximum for readability"`
    const result = reviewCode(TEST_DIR, code)
    expect(result.improvements.some(i => i.includes("120 characters"))).toBe(true)
  })
})

describe("assessArchitecture", () => {
  test("praises separation of concerns", () => {
    const result = assessArchitecture("The system uses separation of concerns with decoupled services")
    expect(result.strengths.some(s => s.includes("separation"))).toBe(true)
  })

  test("flags monolithic concerns", () => {
    const result = assessArchitecture("Everything is in one monolith file")
    expect(result.concerns.some(c => c.includes("monolithic"))).toBe(true)
  })

  test("flags missing failure handling", () => {
    const result = assessArchitecture("The API handles requests and returns responses")
    expect(result.concerns.some(c => c.includes("failure handling"))).toBe(true)
  })

  test("returns risk level based on concerns", () => {
    const result = assessArchitecture("monolith everything together all in one place")
    expect(result.riskLevel).toBe("high")
  })

  test("low risk for good architecture", () => {
    const result = assessArchitecture(
      "We use separation of concerns, with caching for performance, and monitoring for observability, and testing strategy with mocks, with error handling and retry fallback mechanisms",
    )
    expect(result.riskLevel).toBe("low")
  })
})

describe("scanGRC", () => {
  test("flags hardcoded secrets", () => {
    const result = scanGRC(`const password = "admin123"`)
    expect(result.governanceIssues.some(g => g.includes("Secrets"))).toBe(true)
    expect(result.overallRisk).toBe("high")
  })

  test("flags SQL injection risk", () => {
    const result = scanGRC(`const query = "SELECT * FROM users WHERE id = " + userId`)
    expect(result.riskItems.some(r => r.includes("SQL injection"))).toBe(true)
  })

  test("flags XSS vulnerability", () => {
    const result = scanGRC(`element.innerHTML = userInput`)
    expect(result.riskItems.some(r => r.includes("XSS"))).toBe(true)
  })

  test("flags eval usage", () => {
    const result = scanGRC(`eval(userInput)`)
    expect(result.riskItems.some(r => r.includes("code injection"))).toBe(true)
  })

  test("low risk for clean code", () => {
    const result = scanGRC(`function add(a: number, b: number) { return a + b }`)
    expect(result.overallRisk).toBe("low")
  })

  test("flags input without validation", () => {
    const result = scanGRC(`const data = req.body`)
    expect(result.complianceNotes.some(n => n.includes("validation"))).toBe(true)
  })
})

describe("generateMentoringPlan", () => {
  test("includes topic name", () => {
    const plan = generateMentoringPlan(TEST_DIR, "TypeScript")
    expect(plan).toContain("TypeScript")
  })

  test("includes engineering competency", () => {
    const plan = generateMentoringPlan(TEST_DIR, "React")
    expect(plan).toContain("Engineering Competency")
  })
})

describe("updateEngineeringFromReview", () => {
  test("updates engineering scores", () => {
    const review = reviewCode(TEST_DIR, `// test
function test() { return 1 }`)
    updateEngineeringFromReview(TEST_DIR, review)
    // No error = success
  })
})
