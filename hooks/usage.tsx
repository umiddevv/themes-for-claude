import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, On, SessionRateLimit } from 'claude-code'

import type { Totals } from '../types'
import { localTime } from './clock'

export const PANE = 'tokens-pane'
const TITLE = 'Token usage'

const EMPTY: Totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0, subagentTurns: 0 }

// Change the tag when Totals' fields change: it declines what an older version stored.
export const totals = atom({ plugin: 'themes-for-claude', key: 'totals' } as const, EMPTY, { shape: 'totals-1' })

export function compact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`
  }

  return String(n)
}

const BAR = 18

function bar(percent: number): { filled: string; empty: string; color: Color } {
  const p = Math.max(0, Math.min(100, percent))
  const n = Math.round((p / 100) * BAR)
  const color: Color = p >= 85 ? 'error' : p >= 60 ? 'warning' : 'success'

  return { filled: '█'.repeat(n), empty: '░'.repeat(BAR - n), color }
}

function limitName(kind: string): string {
  if (kind === 'five_hour') return '5-hour limit'
  if (kind === 'seven_day') return 'Weekly limit'
  if (kind === 'spend_limit') return 'Spend limit'

  return kind.replace(/_/g, ' ')
}

function resets(limit: SessionRateLimit): string {
  if (limit.resetsAt === undefined) return ''
  const at = Date.parse(limit.resetsAt)

  return Number.isNaN(at) ? '' : ` · resets ${localTime(at)}`
}

export async function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE })
}

export function registerUsage(on: On): void {
  on('command.run', { command: 'tokens' }, async $ => {
    await openPane($)

    return { text: 'Token usage pane opened.' }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const u = e.usage

    if (u !== undefined) {
      const isMain = e.agentId === undefined
      const turn = {
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens,
      }

      await update($, totals, t => ({
        input: t.input + turn.input,
        output: t.output + turn.output,
        cacheRead: t.cacheRead + turn.cacheRead,
        cacheWrite: t.cacheWrite + turn.cacheWrite,
        turns: t.turns + (isMain ? 1 : 0),
        subagentTurns: t.subagentTurns + (isMain ? 0 : 1),
        lastModel: isMain ? u.model : t.lastModel,
        lastTurn: isMain ? turn : t.lastTurn,
      }))
    }

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const t = await read($, totals)
    const usage = await $.session.usage().catch(() => undefined)
    const ctx = usage?.context
    const total = t.input + t.output + t.cacheRead + t.cacheWrite

    const row = (label: string, value: string, strong = false) => (
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor={!strong}>{label}</Text>
        <Text tabular bold={strong}>{value}</Text>
      </Box>
    )

    const meter = (label: string, percent: number, detail: string) => {
      const b = bar(percent)

      return (
        <Box flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text>{label}</Text>
            <Text tabular bold color={b.color}>{`${Math.round(percent)}%`}</Text>
          </Box>
          <Box flexDirection="row">
            <Text mono color={b.color}>{b.filled}</Text>
            <Text mono dimColor>{b.empty}</Text>
          </Box>
          <Text dimColor size="caption">{detail}</Text>
        </Box>
      )
    }

    const turnsText = t.subagentTurns > 0 ? `${t.turns} + ${t.subagentTurns} subagent` : String(t.turns)

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        {ctx !== undefined &&
          meter(
            'Context window',
            ctx.percent ?? ((ctx.tokens ?? 0) / Math.max(1, ctx.window)) * 100,
            `${compact(ctx.tokens ?? 0)} of ${compact(ctx.window)} tokens`,
          )}

        <Box flexDirection="column">
          <Text bold>This session</Text>
          {row('Input', compact(t.input))}
          {row('Output', compact(t.output))}
          {row('Cache read', compact(t.cacheRead))}
          {row('Cache write', compact(t.cacheWrite))}
          {row('Total', compact(total), true)}
          {usage?.cost !== undefined && row('Cost', `$${usage.cost.usd.toFixed(2)}`, true)}
          {row('Turns', turnsText)}
        </Box>

        {t.lastTurn !== undefined && (
          <Box flexDirection="column">
            <Text bold>Last turn</Text>
            {t.lastModel !== undefined && row('Model', t.lastModel)}
            {row(
              'In / out',
              `${compact(t.lastTurn.input + t.lastTurn.cacheRead + t.lastTurn.cacheWrite)} / ${compact(t.lastTurn.output)}`,
            )}
          </Box>
        )}

        {(usage?.rateLimits ?? []).map(limit =>
          meter(limitName(limit.kind), limit.percentUsed, `${Math.round(limit.percentUsed)}% used${resets(limit)}`),
        )}

        {t.turns === 0 && t.subagentTurns === 0 && <Text dimColor>Counts start with the next finished turn.</Text>}
      </Box>
    )
  })
}
