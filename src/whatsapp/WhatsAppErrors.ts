import type { JsonValue } from './Json.js';
import { isJsonObject } from './Json.js';

export class WhatsAppValidationError extends Error {
  override name = 'WhatsAppValidationError';
}

type GraphApiErrorPayload = {
  error?: {
    message?: JsonValue;
    type?: JsonValue;
    code?: JsonValue;
    error_subcode?: JsonValue;
    fbtrace_id?: JsonValue;
  };
};

function extractGraphApiErrorFields(raw: JsonValue | undefined): {
  errorCode?: string | number;
  errorSubcode?: string | number;
} {
  if (!isJsonObject(raw)) return {};

  const payload = raw as GraphApiErrorPayload;
  const errorValue = payload.error as JsonValue | undefined;

  if (!isJsonObject(errorValue)) return {};

  const code = errorValue['code'];
  const subcode = errorValue['error_subcode'];

  return {
    errorCode:
      typeof code === 'number' || typeof code === 'string' ? code : undefined,
    errorSubcode:
      typeof subcode === 'number' || typeof subcode === 'string'
        ? subcode
        : undefined,
  };
}

export class WhatsAppApiError extends Error {
  override name = 'WhatsAppApiError';
  public readonly statusCode?: number;
  public readonly responseBody?: JsonValue;
  public readonly errorCode?: string | number;
  public readonly errorSubcode?: string | number;
  public readonly raw?: JsonValue;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      responseBody?: JsonValue;
      raw?: JsonValue;
      errorCode?: string | number;
      errorSubcode?: string | number;
      cause?: Error;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.statusCode = options?.statusCode;

    this.raw = options?.raw ?? options?.responseBody;
    this.responseBody = options?.responseBody ?? options?.raw;

    const extracted = extractGraphApiErrorFields(this.raw);
    this.errorCode = options?.errorCode ?? extracted.errorCode;
    this.errorSubcode = options?.errorSubcode ?? extracted.errorSubcode;
  }
}
