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

function parseWhatsAppErrorCode(body: unknown): number | undefined {
  const candidate = body as { error?: { code?: unknown } } | undefined;
  const code = candidate?.error?.code;
  return typeof code === 'number' && Number.isFinite(code) ? code : undefined;
}

export function isWhatsAppRetryableError(
  status: number,
  body: unknown,
): boolean {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;

  const errorCode = parseWhatsAppErrorCode(body);
  // WhatsApp Cloud API throttling
  if (errorCode === 131056) return true;

  return false;
}

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

export async function sleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

export function getWhatsAppRetryConfig(
  overrides: Partial<WhatsAppRetryConfig> = {},
): WhatsAppRetryConfig {
  return { ...DEFAULT_RETRY_CONFIG, ...overrides };
}
