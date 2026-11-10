// Build entry for dist/mcp.js — stdio MCP server. See src/mcp/server.ts.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { createMcpServer, resolveMcpOptions } from "./mcp/server"
import { readFileSync } from "fs"

function packageVersion(): string {
  try {
    return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")).version
  } catch {
    return "0.0.0"
  }
}

// stdout carries the MCP protocol; route any stray console.log to stderr.
console.log = console.error
console.info = console.error

try {
  const options = resolveMcpOptions(process.argv.slice(2), process.env, process.cwd())
  const server = createMcpServer({ ...options, version: packageVersion() })
  await server.connect(new StdioServerTransport())
} catch (e) {
  console.error(`[CodingSchool] ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
}
