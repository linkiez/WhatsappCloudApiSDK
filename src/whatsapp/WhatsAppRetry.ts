import type { JsonValue } from './Json.js';
import { isJsonObject } from './Json.js';

export type WhatsAppRetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
};

const DEFAULT_RETRY_CONFIG: WhatsAppRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 5_000,
  jitterRatio: 0.1,
};

function parseWhatsAppErrorCode(body: JsonValue | undefined): number | undefined {
  if (!isJsonObject(body)) return undefined;
  const error = body['error'];
  if (!isJsonObject(error)) return undefined;

  const code = error['code'];
  return typeof code === 'number' && Number.isFinite(code) ? code : undefined;
}

/**
 * Checks whether an API error should be retried.
 *
 * @param status - HTTP status code
 * @param body - Parsed JSON response body (optional)
 * @returns True when the error is considered retryable
 */
export function isWhatsAppRetryableError(
  status: number,
  body: JsonValue | undefined,
): boolean {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;

  const errorCode = parseWhatsAppErrorCode(body);
  // WhatsApp Cloud API throttling
  if (errorCode === 131056) return true;

  return false;
}

/**
 * Calculates exponential backoff delay (with jitter).
 *
 * @param attempt - Current attempt number (1-based)
 * @param overrides - Optional retry configuration overrides
 * @returns Backoff delay in milliseconds
 */
export function calculateBackoffMs(
  attempt: number,
  overrides: Partial<WhatsAppRetryConfig> = {},
): number {
  const config: WhatsAppRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...overrides };

  const exponent = Math.max(0, attempt - 1);
  const base = config.baseDelayMs * Math.pow(2, exponent);
  const capped = Math.min(base, config.maxDelayMs);

  const jitter = capped * config.jitterRatio * Math.random();
  return Math.round(Math.min(capped + jitter, config.maxDelayMs));
}

/**
 * Sleeps for the requested amount of time.
 *
 * @param delayMs - Delay in milliseconds
 * @returns Promise that resolves after the delay
 */
export async function sleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

/**
 * Builds a retry configuration from defaults and overrides.
 *
 * @param overrides - Optional retry configuration overrides
 * @returns Merged retry configuration
 */
export function getWhatsAppRetryConfig(
  overrides: Partial<WhatsAppRetryConfig> = {},
): WhatsAppRetryConfig {
  return { ...DEFAULT_RETRY_CONFIG, ...overrides };
}
