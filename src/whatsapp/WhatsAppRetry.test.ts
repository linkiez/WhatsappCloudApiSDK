import { calculateBackoffMs, isWhatsAppRetryableError } from './WhatsAppRetry';

describe('WhatsAppRetry', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('isWhatsAppRetryableError', () => {
    it('should return true for HTTP 429', () => {
      expect(isWhatsAppRetryableError(429, undefined)).toBe(true);
    });

    it('should return true for WhatsApp throttling error code 131056', () => {
      expect(
        isWhatsAppRetryableError(400, {
          error: {
            code: 131056,
            message: 'Throttled',
          },
        }),
      ).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(
        isWhatsAppRetryableError(400, {
          error: { code: 100, message: 'Bad request' },
        }),
      ).toBe(false);
    });
  });

  describe('calculateBackoffMs', () => {
    it('should calculate exponential backoff with jitter', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);

      expect(calculateBackoffMs(1, { baseDelayMs: 250 })).toBe(250);
      expect(calculateBackoffMs(2, { baseDelayMs: 250 })).toBe(500);
      expect(calculateBackoffMs(3, { baseDelayMs: 250 })).toBe(1000);
    });

    it('should cap backoff at maxDelayMs', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);

      expect(
        calculateBackoffMs(10, { baseDelayMs: 250, maxDelayMs: 1000 }),
      ).toBe(1000);
    });
  });
});
