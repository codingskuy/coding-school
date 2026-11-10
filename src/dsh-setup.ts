// Build entry for dist/dsh-setup.js — used by `coding-school setup --platform dsh`.
import { fileURLToPath } from "url"

import { writeDshFiles, DSH_HOOKS_PACKAGE } from "./dsh/patch"

export { DSH_HOOKS_PACKAGE }

export function writeCodingSchoolDshFiles(dir: string): string {
  return writeDshFiles(dir, {
    mcpServer: fileURLToPath(new URL("./mcp.js", import.meta.url)),
    gateCheck: fileURLToPath(new URL("./gate-check.js", import.meta.url)),
  })
}
