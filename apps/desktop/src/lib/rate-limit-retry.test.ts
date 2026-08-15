import { describe, expect, it } from 'vitest'

import { parseGeminiRateLimitRetry } from './rate-limit-retry'

describe('parseGeminiRateLimitRetry', () => {
  it('parses the retry window from a real Gemini 429 message', () => {
    const message =
      'Gemini HTTP 429 (RESOURCE_EXHAUSTED): You exceeded your current quota, please check your plan and billing details. ' +
      'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, ' +
      'model: gemini-3.5-flash Please retry in 42.100297789s.'

    expect(parseGeminiRateLimitRetry(message)).toBeCloseTo(42.100297789, 6)
  })

  it('parses a whole-second retry window', () => {
    expect(parseGeminiRateLimitRetry('HTTP 429 (RESOURCE_EXHAUSTED) ... Please retry in 5s.')).toBe(5)
  })

  it('matches the quota metric even when the status line differs', () => {
    expect(
      parseGeminiRateLimitRetry(
        'Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests ' +
          'Please retry in 30 seconds.'
      )
    ).toBe(30)
  })

  it('clamps absurd windows to a bounded backoff', () => {
    expect(parseGeminiRateLimitRetry('HTTP 429 (RESOURCE_EXHAUSTED) Please retry in 600s.')).toBe(120)
    expect(parseGeminiRateLimitRetry('HTTP 429 (RESOURCE_EXHAUSTED) Please retry in 0.25s.')).toBe(1)
  })

  it('returns null for a 429 that is not Gemini', () => {
    expect(
      parseGeminiRateLimitRetry('OpenAI API error 429: Rate limit reached for gpt-4o. Please retry in 20s.')
    ).toBeNull()
  })

  it('returns null for a Gemini 429 without a retry window', () => {
    expect(parseGeminiRateLimitRetry('Gemini HTTP 429 (RESOURCE_EXHAUSTED): quota exceeded.')).toBeNull()
  })

  it('returns null for unrelated messages and empty input', () => {
    expect(parseGeminiRateLimitRetry('Connection reset by peer')).toBeNull()
    expect(parseGeminiRateLimitRetry('')).toBeNull()
  })
})
