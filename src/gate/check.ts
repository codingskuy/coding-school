import { hasOpenClaim } from "../coach-gate"

export interface WriteDecision {
  allow: boolean
  reason: string
}

// Claim-gate rule shared by every host adapter: file writes are allowed ONLY
// while a comprehension claim is open (cs_claim_open).
export function decideWrite(projectDir: string): WriteDecision {
  if (hasOpenClaim(projectDir)) {
    return { allow: true, reason: "A comprehension claim is open." }
  }
  return {
    allow: false,
    reason: "CodingSchool: no open comprehension claim. Call cs_claim_open before writing files.",
  }
}
