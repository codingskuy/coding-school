import type { Persona, PersonaId } from "./types"

export const TEACHER: Persona = {
  id: "teacher",
  description: "Software engineering teacher — diagnosis-first, scaffolded teaching, reflection-driven",
  writePolicy: "never",
  handoffTo: "coach",
  default: true,
}

export const COACH: Persona = {
  id: "coach",
  description: "Software engineering project mentor — code review, architecture, GRC awareness, engineering competency",
  writePolicy: "claim-gated",
  handoffTo: "teacher",
  default: false,
}

export const PERSONAS: Record<PersonaId, Persona> = { teacher: TEACHER, coach: COACH }
