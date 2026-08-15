/**
 * Recognition of Gemini quota-exhaustion (HTTP 429) turn failures.
 *
 * The Gemini API answers free-tier quota abuse with a 429 carrying
 * "RESOURCE_EXHAUSTED" and a "Please retry in Xs" backoff window, e.g.:
 * "Gemini HTTP 429 (RESOURCE_EXHAUSTED): ... Quota exceeded for metric:
 * generativelanguage.googleapis.com/generate_content_free_tier_requests,
 * limit: 20, model: gemini-3.5-flash Please retry in 42.100297789s."
 *
 * A turn dying on this error can strand real work — a merge whose conflicts
 * were resolved but never committed. The caller re-submits 'continue' after
 * the server's suggested window instead of making the user re-prompt by hand.
 */

const GEMINI_RATE_LIMIT_PATTERNS = [
  /429\s*\(RESOURCE_EXHAUSTED\)/i,
  /Quota exceeded for metric:\s*generativelanguage\.googleapis\.com/i
]

const RETRY_WINDOW_PATTERN = /Please retry in\s+([\d.]+)\s*s?\.?/i

const MIN_RETRY_SECONDS = 1
const MAX_RETRY_SECONDS = 120

/** Seconds to wait before retrying, or null when the message is not a Gemini 429. */
export function parseGeminiRateLimitRetry(message: string): null | number {
  const text = String(message ?? '')

  if (!GEMINI_RATE_LIMIT_PATTERNS.some(pattern => pattern.test(text))) {
    return null
  }

  const match = text.match(RETRY_WINDOW_PATTERN)

  if (!match) {
    return null
  }

  const seconds = Number(match[1])

  if (!Number.isFinite(seconds)) {
    return null
  }

  return Math.min(MAX_RETRY_SECONDS, Math.max(MIN_RETRY_SECONDS, seconds))
}
