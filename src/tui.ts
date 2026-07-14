import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { existsSync } from "fs"
import { join } from "path"

import { buildCodingSchoolView } from "./sidebar/views"
import type { ViewNode } from "./sidebar/element-helpers"

type SolidRuntime<Node> = {
  readonly createElement: (tag: string) => Node
  readonly insert: (parent: Node, child: Node | string) => unknown
  readonly setProp: (node: Node, name: string, value: unknown) => unknown
}

// The runtime slot registration accepts { order, slots } format;
// TuiSlotPlugin from types is the typed wrapper, but the runtime
// accepts a simpler shape. We coerce through unknown to match runtime behavior.
type AnySlotRegistration = {
  order: number
  slots: {
    sidebar_content: () => unknown
  }
}

function materialize<Node>(nodes: readonly ViewNode[], solid: SolidRuntime<Node>): Node {
  const root = solid.createElement("box")
  solid.setProp(root, "flexDirection", "column")
  for (const node of nodes) {
    solid.insert(root, materializeNode(node, solid))
  }
  return root
}

function materializeNode<Node>(node: ViewNode, solid: SolidRuntime<Node>): Node {
  const element = solid.createElement(node.kind)
  for (const [name, value] of Object.entries(node.props)) {
    solid.setProp(element, name, value)
  }
  if (node.kind === "text") {
    solid.insert(element, node.text ?? "")
  }
  for (const child of node.children ?? []) {
    solid.insert(element, materializeNode(child, solid))
  }
  return element
}

const POLL_INTERVAL_MS = 2_000

const module: TuiPluginModule = {
  id: "coding-school:tui",
  tui: async (api) => {
    const solid = await import("@opentui/solid").catch(() => null)
    if (!solid) {
      return
    }

    const directory = api.state.path.directory
    const worktree = api.state.path.worktree

    const roadmapDir = join(directory, ".codingschool", "roadmap")
    if (!existsSync(roadmapDir)) {
      return
    }

    let currentNodes = buildCodingSchoolView(directory, worktree, api.theme.current)
    let currentKey = JSON.stringify(currentNodes)
    let disposed = false
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const registration: AnySlotRegistration = {
      order: 800,
      slots: {
        sidebar_content: () => materialize(currentNodes, solid as SolidRuntime<unknown>),
      },
    }
    api.slots.register(registration as never)
    api.renderer.requestRender()

    const schedule = (): void => {
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    const tick = async (): Promise<void> => {
      if (disposed || inFlight) {
        if (!disposed) schedule()
        return
      }
      inFlight = true
      try {
        const nextNodes = buildCodingSchoolView(directory, worktree, api.theme.current)
        const nextKey = JSON.stringify(nextNodes)
        if (nextKey !== currentKey) {
          currentNodes = nextNodes
          currentKey = nextKey
          api.renderer.requestRender()
        }
      } finally {
        inFlight = false
        if (!disposed) schedule()
      }
    }

    schedule()
    api.lifecycle.onDispose(() => {
      disposed = true
      if (timer) clearTimeout(timer)
    })
  },
}

export default module
