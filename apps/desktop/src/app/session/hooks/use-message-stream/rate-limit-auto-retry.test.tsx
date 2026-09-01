import { QueryClient } from '@tanstack/react-query'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientSessionState } from '@/app/types'
import { createClientSessionState } from '@/lib/chat-runtime'
import { $gateway } from '@/store/gateway'
import type { RpcEvent } from '@/types/hermes'

import { useMessageStream } from './index'

const SID = 'session-1'

// A real Gemini free-tier quota error, exactly as the gateway surfaces it —
// the turn dies (e.g. mid-merge) and the stream must resume it on its own.
const GEMINI_429_MESSAGE =
  'Gemini HTTP 429 (RESOURCE_EXHAUSTED): You exceeded your current quota, please check your plan and billing details. ' +
  'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, ' +
  'model: gemini-3.5-flash Please retry in 42.100297789s.'

const GEMINI_429_BACKOFF_MS = 42_101

let handleEvent: ((event: RpcEvent) => void) | null = null
let sessionStates: Map<string, ClientSessionState>

function Harness() {
  const activeSessionIdRef = useRef<string | null>(SID)
  const sessionStateByRuntimeIdRef = useRef(new Map<string, ClientSessionState>())
  const queryClientRef = useRef(new QueryClient())

  const stream = useMessageStream({
    activeSessionIdRef,
    hydrateFromStoredSession: vi.fn(async () => undefined),
    queryClient: queryClientRef.current,
    refreshHermesConfig: vi.fn(async () => undefined),
    refreshSessions: vi.fn(async () => undefined),
    sessionStateByRuntimeIdRef,
    updateSessionState: (sessionId, updater) => {
      const current = sessionStateByRuntimeIdRef.current.get(sessionId) ?? createClientSessionState()
      const next = updater(current)
      sessionStateByRuntimeIdRef.current.set(sessionId, next)
      sessionStates.set(sessionId, next)

      return next
    }
  })

  useEffect(() => {
    handleEvent = stream.handleGatewayEvent
  }, [stream.handleGatewayEvent])

  return null
}

async function mountStream() {
  sessionStates = new Map()
  render(<Harness />)
  await waitFor(() => expect(handleEvent).not.toBeNull())
}

const error = (message: string) => act(() => handleEvent!({ payload: { message }, session_id: SID, type: 'error' }))

const start = () => act(() => handleEvent!({ payload: {}, session_id: SID, type: 'message.start' }))

describe('Gemini 429 rate-limit auto-retry', () => {
  beforeEach(() => {
    handleEvent = null
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    $gateway.set(null)
  })

  it('resubmits continue after the server backoff window', async () => {
    await mountStream()
    const request = vi.fn().mockResolvedValue({})

    $gateway.set({ request } as never)
    vi.useFakeTimers()

    await error(GEMINI_429_MESSAGE)

    expect(request).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEMINI_429_BACKOFF_MS)
    })

    expect(request).toHaveBeenCalledWith('prompt.submit', { session_id: SID, text: 'continue' })
  })

  it('bounded: gives up after two consecutive failures', async () => {
    await mountStream()
    const request = vi.fn().mockResolvedValue({})

    $gateway.set({ request } as never)
    vi.useFakeTimers()

    // First failure schedules one retry, which fires and submits.
    await error(GEMINI_429_MESSAGE)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEMINI_429_BACKOFF_MS)
    })

    expect(request).toHaveBeenCalledTimes(1)

    // The retried turn fails again — the attempt count carried over, so the
    // second (and final) retry still fires.
    await error(GEMINI_429_MESSAGE)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEMINI_429_BACKOFF_MS)
    })

    expect(request).toHaveBeenCalledTimes(2)

    // A third consecutive failure exceeds the bound: no more auto-submits.
    await error(GEMINI_429_MESSAGE)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEMINI_429_BACKOFF_MS)
    })

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('a real turn cancels the pending retry', async () => {
    await mountStream()
    const request = vi.fn().mockResolvedValue({})

    $gateway.set({ request } as never)
    vi.useFakeTimers()

    await error(GEMINI_429_MESSAGE)
    await start()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEMINI_429_BACKOFF_MS)
    })

    expect(request).not.toHaveBeenCalled()
  })

  it('ignores non-Gemini turn errors', async () => {
    await mountStream()
    const request = vi.fn().mockResolvedValue({})

    $gateway.set({ request } as never)
    vi.useFakeTimers()

    await error('OpenAI API error 429: Rate limit reached for gpt-4o. Please retry in 20s.')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GEMINI_429_BACKOFF_MS)
    })

    expect(request).not.toHaveBeenCalled()
  })
})
