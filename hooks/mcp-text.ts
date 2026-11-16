import type { EngineInterface } from 'claude-code'

// Calls an MCP tool and returns its text, with a timeout.

async function timeout($: EngineInterface, ms: number): Promise<never> {
  try {
    await $.clock.sleep(ms)
  } catch {
    // Where the clock can't sleep, no timeout rather than a false one.
    return new Promise<never>(() => undefined)
  }
  throw new Error(`no answer in ${ms / 1000} s`)
}

export async function mcpText($: EngineInterface, server: string, tool: string, args: Record<string, unknown>, ms = 30_000): Promise<string> {
  const r = (await Promise.race([$.mcp.call(server, tool, args), timeout($, ms)])) as { content: { type: string; text?: string }[]; isError: boolean }
  const text = r.content.map(b => (b.type === 'text' ? (b.text ?? '') : '')).join('\n')
  if (r.isError) throw new Error(text || 'the tool reported an error')

  return text
}
