export class WhatsAppValidationError extends Error {
  override name = 'WhatsAppValidationError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class WhatsAppApiError extends Error {
  override name = 'WhatsAppApiError';
  public readonly statusCode?: number;
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    options?: { statusCode?: number; responseBody?: unknown; cause?: unknown },
  ) {
    super(message, options);
    this.statusCode = options?.statusCode;
    this.responseBody = options?.responseBody;
  }
}
