// Regenerates the Claude Code plugin files. Run: bun run gen:claude-code
import { mkdirSync, writeFileSync } from "fs"
import { dirname, join } from "path"

import { renderPluginFiles } from "../src/claude-code/plugin"
import pkg from "../package.json"

const root = join(import.meta.dir, "..")
for (const [path, content] of Object.entries(renderPluginFiles(pkg.version))) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
  console.log(`wrote ${path}`)
}
