import { WhatsAppValidationError } from './WhatsAppErrors.js';

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

type DecideMessageTypeParams = {
  recipientWaId: string;
  lastInboundAt: Date | undefined;
  requestedType: string;
  now?: Date;
};

export function decideMessageType(params: DecideMessageTypeParams): string {
  const now = params.now ?? new Date();

  if (params.requestedType === 'template') {
    return 'template';
  }

  if (params.lastInboundAt) {
    const ageMs = now.getTime() - params.lastInboundAt.getTime();

    if (Number.isFinite(ageMs) && ageMs <= WHATSAPP_WINDOW_MS && ageMs >= 0) {
      return params.requestedType;
    }
  }

  throw new WhatsAppValidationError(
    'WhatsApp service window is closed. Send a template message.',
  );
}
