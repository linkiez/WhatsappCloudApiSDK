import { WhatsAppValidationError } from './WhatsAppErrors';

import { decideMessageType } from './WhatsAppSendPolicy';

describe('WhatsAppSendPolicy', () => {
  describe('decideMessageType', () => {
    it('should allow non-template types when last inbound is within 24h', () => {
      const now = new Date('2025-01-01T12:00:00.000Z');
      const lastInboundAt = new Date('2025-01-01T11:00:00.000Z');

      expect(
        decideMessageType({
          recipientWaId: '5511999999999',
          lastInboundAt,
          requestedType: 'text',
          now,
        }),
      ).toBe('text');
    });

    it('should allow template even when last inbound is missing', () => {
      const now = new Date('2025-01-01T12:00:00.000Z');

      expect(
        decideMessageType({
          recipientWaId: '5511999999999',
          lastInboundAt: undefined,
          requestedType: 'template',
          now,
        }),
      ).toBe('template');
    });

    it('should throw WhatsAppValidationError when window is closed for non-template types', () => {
      const now = new Date('2025-01-02T12:00:00.000Z');
      const lastInboundAt = new Date('2025-01-01T11:00:00.000Z');

      expect(() =>
        decideMessageType({
          recipientWaId: '5511999999999',
          lastInboundAt,
          requestedType: 'text',
          now,
        }),
      ).toThrow(WhatsAppValidationError);
    });
  });
});
