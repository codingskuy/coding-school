import { existsSync, readFileSync, rmSync, writeFileSync } from "fs"
import type {
  ClaimRecord,
  ClaimVerdict,
  ComprehensionAnswer,
  EngineeringLevel,
} from "./utils/types"
import { readJson, writeJson } from "./utils/fs"
import { claimPath, timelinePath } from "./utils/paths"
import { updateTimelineItem } from "./timeline/generator"
import { loadEngineering, saveEngineering } from "./competency"
import { announceClaimResult } from "./context"
import {
  buildComprehensionQuestions,
  computeComprehensionConfidence,
} from "./comprehension"
import { adjustedReexplainLevel } from "./meta"

export interface OpenClaimOptions {
  projectDir: string
  projectName: string
  itemName: string
  files: string[]
}

export interface SubmitClaimOptions {
  projectDir: string
  projectName: string
  itemName: string
  verdict: ClaimVerdict
  level?: EngineeringLevel
  notes?: string
  qa?: ComprehensionAnswer[]
  confidence?: number
}

export const ENGINEERING_LEVELS: Record<EngineeringLevel, { label: string; description: string; bump: number }> = {
  junior: {
    label: "Junior",
    description: "solusi sederhana dan mudah dibaca: satu konsep per langkah, sedikit bagian, komentar ramah pemula",
    bump: 2,
  },
  mid: {
    label: "Mid",
    description: "solusi idiomatic dan terstruktur: fungsi kecil yang jelas, penamaan yang baik, alur yang rapi",
    bump: 4,
  },
  senior: {
    label: "Senior",
    description: "solusi robust: error handling, validasi input, best practices, mudah dirawat dan diextend",
    bump: 6,
  },
}

export function openClaim(options: OpenClaimOptions): string {
  const { projectDir, projectName, itemName, files } = options
  if (!existsSync(timelinePath(projectDir, projectName))) {
    return `Project "${projectName}" not found. Initialize it first with cs_timeline_init.`
  }
  if (!files || files.length === 0) {
    return "Provide at least one file path to claim."
  }

  const existing = loadClaims(projectDir, projectName)
  if (existing && existing.status === "open") {
    return `There is already an open claim for item "${existing.item}". Resolve it (pass/fail/revert) before opening a new one.`
  }

  const claim: ClaimRecord = {
    projectName,
    item: itemName,
    status: "open",
    files: files.map(p => {
      const existed = existsSync(p)
      return {
        path: p,
        existed,
        originalContent: existed ? readFileSync(p, "utf-8") : undefined,
      }
    }),
    attempts: 0,
    openedAt: new Date().toISOString(),
    qaHistory: [],
    confidence: 0,
  }

  writeJson(claimPath(projectDir, projectName), claim)
  updateTimelineItem({ projectDir, projectName, itemName, status: "in-progress", notes: "Menunggu user membuktikan pemahaman (comprehension gate)." })

  return `Claim dibuka untuk "${itemName}". Kondisi awal ${claim.files.length} file tersimpan (${claim.files.filter(f => f.existed).length} lama, ${claim.files.filter(f => !f.existed).length} baru).

Timeline item kini "in-progress". Sekarang: tulis kode ke file-file tersebut, lalu jalankan comprehension gate (2-3 pertanyaan). Kode hanya final saat user "claim" (pass).`
}

export function submitClaim(options: SubmitClaimOptions): string {
  const { projectDir, projectName, itemName, verdict } = options
  const claim = loadClaims(projectDir, projectName)

  if (!claim) {
    return `Tidak ada claim yang terbuka. Buka dulu dengan cs_claim_open untuk item "${itemName}".`
  }
  if (claim.status !== "open") {
    return `Claim untuk "${claim.item}" sudah diselesaikan (status: ${claim.status}).`
  }
  if (claim.item !== itemName) {
    return `Claim yang terbuka adalah untuk "${claim.item}", bukan "${itemName}".`
  }

  // Multi-turn grading: persist per-question evidence + aggregate confidence.
  claim.qaHistory = claim.qaHistory ?? []
  claim.confidence = claim.confidence ?? 0
  if (options.qa && options.qa.length > 0) {
    claim.qaHistory = [...claim.qaHistory, ...options.qa]
  }
  if (claim.qaHistory.length > 0) {
    claim.confidence = computeComprehensionConfidence(claim.qaHistory)
  } else if (options.confidence !== undefined) {
    claim.confidence = Math.max(0, Math.min(100, Math.round(options.confidence)))
  }

  if (verdict === "fail") {
    claim.attempts += 1
    const level = adjustedReexplainLevel(projectDir, projectName, options.level ?? levelForAttempt(claim.attempts))
    writeJson(claimPath(projectDir, projectName), claim)
    const nextQuestions = buildComprehensionQuestions(level, claim.files.map(f => f.path))
      .slice(0, 3)
      .map(q => `- ${q.question}`)
      .join("\n")
    return `Pemahaman belum terbukti (percobaan ke-${claim.attempts}, confidence ${claim.confidence}/100).

Jelaskan ulang di level **${ENGINEERING_LEVELS[level].label}** dengan bahasa sederhana — ${ENGINEERING_LEVELS[level].description}.

Pertanyaan probing level ${ENGINEERING_LEVELS[level].label} untuk percobaan berikutnya:
${nextQuestions}

Lalu tanya via question tool: "Mau coba lagi, atau saya tarik kodenya (revert)?"
- Coba lagi → jawab pertanyaan comprehension baru (catat jawabannya di arg qa saat cs_claim_submit).
- Revert → panggil cs_claim_submit dengan verdict="revert".`
  }

  if (verdict === "revert") {
    revertClaimFiles(claim)
    claim.status = "reverted"
    claim.resolvedAt = new Date().toISOString()
    writeJson(claimPath(projectDir, projectName), claim)
    updateTimelineItem({
      projectDir,
      projectName,
      itemName,
      status: "todo",
      notes: options.notes || "Reverted — user belum bisa membuktikan pemahaman atas kode yang digenerate.",
    })
    return `Kode ditarik. ${claim.files.length} file dikembalikan ke kondisi awal (baru dihapus, lama direstore).
Timeline item "${itemName}" kembali ke "todo". (Confidence saat gate: ${claim.confidence}/100)`
  }

  if (verdict === "partial-pass-continue") {
    claim.attempts += 1
    writeJson(claimPath(projectDir, projectName), claim)
    updateTimelineItem({
      projectDir,
      projectName,
      itemName,
      status: "in-progress",
      notes:
        options.notes ||
        `Pass sebagian (confidence ${claim.confidence}/100) — kode dipertahankan, lanjutkan dengan pengawasan.`,
    })
    const weakAnswers = claim.qaHistory.filter(q => q.score !== "correct")
    const focus = weakAnswers.length > 0
      ? `Fokus perbaiki: ${weakAnswers.slice(0, 3).map(q => `"${truncate(q.question, 60)}"`).join(", ")}`
      : "Lanjutkan ke item berikutnya dengan memantau pemahaman."
    return `Pass SEBAGIAN (confidence ${claim.confidence}/100) — di bawah ambang 75.

Kode dipertahankan, claim tetap terbuka. Timeline item "${itemName}" tetap "in-progress".
${focus}
Setelah siswa memperkuat pemahaman, panggil cs_claim_submit lagi dengan verdict="pass" (atau "revert" jika gagal lagi).`
  }

  const level = options.level ?? "junior"
  updateEngineeringFromClaim(projectDir, level)
  announceClaimResult(projectDir, level)
  claim.status = "claimed"
  claim.successLevel = level
  claim.resolvedAt = new Date().toISOString()
  writeJson(claimPath(projectDir, projectName), claim)
  updateTimelineItem({
    projectDir,
    projectName,
    itemName,
    status: "done",
    notes: options.notes || `Claimed di level ${ENGINEERING_LEVELS[level].label} (confidence ${claim.confidence}/100).`,
  })
  const lowConfidenceNote =
    claim.confidence > 0 && claim.confidence < 75
      ? `\n\n⚠️ Confidence ${claim.confidence}/100 < 75 — Coach sebaiknya memantau pemahaman ini di review berikutnya.`
      : ""
  return `Kode di-claim! User berhasil membuktikan pemahaman di level **${ENGINEERING_LEVELS[level].label}** (confidence ${claim.confidence}/100).
Engineering competency diperbarui. Timeline item "${itemName}" selesai (done).${lowConfidenceNote}`
}

export function updateEngineeringFromClaim(projectDir: string, level: EngineeringLevel): void {
  const current = loadEngineering(projectDir)
  const bump = ENGINEERING_LEVELS[level].bump
  const clamped = (v: number) => Math.max(0, Math.min(100, Math.round(v)))
  current.collaboration = clamped(current.collaboration + bump)
  current.documentation = clamped(current.documentation + Math.round(bump / 2))
  current.codeQuality = clamped(current.codeQuality + Math.round(bump / 2))
  saveEngineering(projectDir, current)
}

function loadClaims(projectDir: string, projectName: string): ClaimRecord | null {
  return readJson<ClaimRecord | null>(claimPath(projectDir, projectName), null)
}

function revertClaimFiles(claim: ClaimRecord): void {
  for (const file of claim.files) {
    if (file.existed) {
      writeFileSync(file.path, file.originalContent ?? "", "utf-8")
    } else if (existsSync(file.path)) {
      rmSync(file.path, { force: true })
    }
  }
}

function levelForAttempt(attempts: number): EngineeringLevel {
  if (attempts >= 2) return "senior"
  if (attempts === 1) return "mid"
  return "junior"
}

function truncate(value: string, max = 60): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}
