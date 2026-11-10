import type { z } from "zod"

export type Platform = "opencode" | "claude-code" | "pi" | "dsh" | "mcp"

export interface ToolContext {
  projectDir: string
  platform: Platform
}

// Platform-neutral tool definition. `args` receives the host's zod namespace
// (e.g. OpenCode's `tool.schema`) so schemas are never mixed across zod instances.
export interface ToolDef<Shape extends z.ZodRawShape = z.ZodRawShape> {
  description: string
  args: (schema: typeof z) => Shape
  execute(args: z.infer<z.ZodObject<Shape>>): Promise<string>
}

export function defineTool<Shape extends z.ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> {
  return def
}
