import { loadStudentModel } from "./student-model"
import { loadCompetency, loadEngineering } from "./competency"

export interface NextStepRecommendation {
  topic: string
  reason: string
  priority: "high" | "medium" | "low"
  category: "extend" | "deepen" | "complement"
}

interface ProgressionEntry {
  extend: string[]
  deepen: string[]
  complement: string[]
}

const PROGRESSION_MAP: Record<string, ProgressionEntry> = {
  mobile: {
    extend: ["Flutter", "React Native", "Kotlin Coroutines", "Jetpack Compose"],
    deepen: ["Android Testing", "Android Architecture Components"],
    complement: ["Git & GitHub", "CI/CD with GitHub Actions"],
  },
  web: {
    extend: ["TypeScript", "Next.js", "Tailwind CSS", "Astro"],
    deepen: ["Web Performance", "Web Accessibility (a11y)", "Progressive Web Apps"],
    complement: ["Git & GitHub", "Testing Strategies", "Docker Basics"],
  },
  uiux: {
    extend: ["Design Systems", "Motion Design", "User Research Methods"],
    deepen: ["Usability Testing", "Information Architecture"],
    complement: ["HTML & CSS", "Figma Advanced"],
  },
  "data-science": {
    extend: ["Pandas & NumPy", "Data Visualization", "Machine Learning Basics"],
    deepen: ["Feature Engineering", "Model Evaluation"],
    complement: ["Git & GitHub", "SQL Basics", "Docker Basics"],
  },
  devops: {
    extend: ["Kubernetes", "Terraform", "AWS Fundamentals"],
    deepen: ["Monitoring & Observability", "Security Hardening"],
    complement: ["Git & GitHub", "Python Scripting"],
  },
  rust: {
    extend: ["Async Rust", "WebAssembly with Rust", "Embedded Rust"],
    deepen: ["Unsafe Rust", "Performance Optimization"],
    complement: ["Git & GitHub", "CI/CD with GitHub Actions"],
  },
  go: {
    extend: ["Go Concurrency", "Go Web Services", "Go CLI Tools"],
    deepen: ["Go Performance", "Go Testing Patterns"],
    complement: ["Git & GitHub", "Docker Basics"],
  },
}

const WEAK_DIMENSION_RECOMMENDATIONS: Record<string, { topic: string; reason: string }> = {
  codeQuality: { topic: "Clean Code Practices", reason: "Your code quality scores suggest room for improvement in naming, structure, and DRY principles" },
  architectureThinking: { topic: "System Design Fundamentals", reason: "Architecture thinking is a key area to level up — let's strengthen your design patterns" },
  testingMindset: { topic: "Testing Strategies", reason: "Testing scores are lower than other dimensions — building this skill will make you a more reliable engineer" },
  documentation: { topic: "Technical Writing & Documentation", reason: "Good documentation multiplies your impact — let's practice writing clear ADRs and READMEs" },
  collaboration: { topic: "Code Review & Collaboration", reason: "Collaboration skills are essential for team work — let's practice giving and receiving feedback" },
  grcAwareness: { topic: "Security Fundamentals", reason: "Security awareness needs attention — let's learn to spot common vulnerabilities (OWASP Top 10)" },
  riskAssessment: { topic: "Risk Assessment & Mitigation", reason: "Risk assessment scores suggest more practice with identifying and mitigating project risks" },
  gitProcess: { topic: "Git & GitHub Workflow", reason: "Git proficiency will accelerate your workflow — let's solidify branching, merging, and PR best practices" },
}

function topicToCategory(topic: string): string | null {
  const lower = topic.toLowerCase()
  const map: Record<string, string[]> = {
    mobile: ["android", "kotlin", "java", "ios", "swift", "mobile", "flutter", "react native"],
    web: ["web", "frontend", "backend", "react", "next", "vue", "angular", "node", "express", "html", "css", "javascript", "typescript"],
    uiux: ["ui", "ux", "uiux", "ui/ux", "design", "figma", "prototype", "wireframe"],
    "data-science": ["python", "data", "machine learning", "ml", "ai", "pandas", "numpy", "tensorflow", "analytics"],
    devops: ["devops", "ci/cd", "docker", "kubernetes", "k8s", "terraform", "aws", "cloud"],
    rust: ["rust", "cargo"],
    go: ["go", "golang"],
  }
  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some(kw => lower.includes(kw))) return cat
  }
  return null
}

function getExtendReason(topic: string, velocity: string): string {
  const speedHint = velocity === "fast" ? "You're a fast learner — ready for the next challenge" :
    velocity === "slow" ? "Take your time, but this is a natural next step" :
    "Solid progress — here's a natural next topic to explore"
  return `${speedHint}. ${topic} builds directly on what you just learned.`
}

function getDeepenReason(dimension: string, score: number): string {
  return `Your ${dimension.replace(/([A-Z])/g, " $1").toLowerCase()} score is ${score}/100. Strengthening this will round out your skills.`
}

export function generateRecommendations(projectDir: string, completedTopic: string): NextStepRecommendation[] {
  const model = loadStudentModel()
  const competency = loadCompetency(projectDir)
  const engineering = loadEngineering(projectDir)
  const recommendations: NextStepRecommendation[] = []

  const category = topicToCategory(completedTopic)
  const entry = category ? PROGRESSION_MAP[category] : null

  if (entry) {
    const velocity = model?.learningVelocity ?? "steady"
    for (const topic of entry.extend) {
      const alreadyStudied = model?.knowledge?.[topic.toLowerCase()]
      if (!alreadyStudied) {
        recommendations.push({
          topic,
          reason: getExtendReason(topic, velocity),
          priority: "high",
          category: "extend",
        })
      }
    }
    for (const topic of entry.deepen) {
      const alreadyStudied = model?.knowledge?.[topic.toLowerCase()]
      if (!alreadyStudied) {
        recommendations.push({
          topic,
          reason: `Deepen your ${category} expertise — ${topic} strengthens practical skills.`,
          priority: "medium",
          category: "deepen",
        })
      }
    }
  }

  if (engineering) {
    const dims: Array<{ key: keyof typeof engineering; label: string }> = [
      { key: "codeQuality", label: "Code Quality" },
      { key: "architectureThinking", label: "Architecture Thinking" },
      { key: "testingMindset", label: "Testing Mindset" },
      { key: "documentation", label: "Documentation" },
      { key: "collaboration", label: "Collaboration" },
      { key: "grcAwareness", label: "GRC Awareness" },
      { key: "riskAssessment", label: "Risk Assessment" },
      { key: "gitProcess", label: "Git Process" },
    ]
    const weakDims = dims
      .map(d => ({ ...d, score: engineering[d.key] }))
      .filter(d => d.score < 50)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)

    for (const dim of weakDims) {
      const rec = WEAK_DIMENSION_RECOMMENDATIONS[dim.key]
      if (rec) {
        const alreadyRecommended = recommendations.some(r => r.topic === rec.topic)
        if (!alreadyRecommended) {
          recommendations.push({
            topic: rec.topic,
            reason: rec.reason,
            priority: dim.score < 30 ? "high" : "medium",
            category: "complement",
          })
        }
      }
    }
  }

  if (model?.weakAreas?.length) {
    for (const area of model.weakAreas.slice(0, 2)) {
      const alreadyRecommended = recommendations.some(r => r.topic.toLowerCase() === area.toLowerCase())
      if (!alreadyRecommended) {
        recommendations.push({
          topic: area,
          reason: `This was flagged as a weak area during your learning sessions.`,
          priority: "low",
          category: "complement",
        })
      }
    }
  }

  return recommendations.slice(0, 10)
}


export function renderRecommendations(recommendations: NextStepRecommendation[]): string {
  if (recommendations.length === 0) {
    return "Great job completing this topic! Explore any area that interests you next."
  }

  const lines: string[] = []
  lines.push("## Recommended Next Steps")
  lines.push("")

  const byCategory = {
    extend: recommendations.filter(r => r.category === "extend"),
    deepen: recommendations.filter(r => r.category === "deepen"),
    complement: recommendations.filter(r => r.category === "complement"),
  }

  if (byCategory.extend.length) {
    lines.push("### 🚀 Continue Your Journey")
    lines.push("Topics that build on what you just learned:")
    for (const r of byCategory.extend) {
      lines.push(`- **${r.topic}** — ${r.reason}`)
    }
    lines.push("")
  }

  if (byCategory.deepen.length) {
    lines.push("### 🔬 Go Deeper")
    lines.push("Strengthen your expertise in this domain:")
    for (const r of byCategory.deepen) {
      lines.push(`- **${r.topic}** — ${r.reason}`)
    }
    lines.push("")
  }

  if (byCategory.complement.length) {
    lines.push("### 🧩 Fill Your Gaps")
    lines.push("Skills that complement your learning profile:")
    for (const r of byCategory.complement) {
      lines.push(`- **${r.topic}** — ${r.reason}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
