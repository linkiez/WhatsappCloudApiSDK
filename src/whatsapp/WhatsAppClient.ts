import type { JsonValue } from './Json.js';
import { isJsonArray, isJsonObject } from './Json.js';
import { WhatsAppApiError, WhatsAppValidationError } from './WhatsAppErrors.js';
import {
  defaultRequestFn,
  readJsonSafely,
  type WhatsAppRequestFn,
} from './WhatsAppRequest.js';
import { buildGraphUrl, isNonEmptyString } from './whatsAppUtils.js';

export type WhatsAppClientOptions = {
  accessToken: string;
  apiVersion: string;
  phoneNumberId: string;
  baseUrl?: string;
  requestFn?: WhatsAppRequestFn;
};

export type WhatsAppMessagingProduct = 'whatsapp';

export type WhatsAppSendMessageBase = {
  to: string;
  messagingProduct?: WhatsAppMessagingProduct;
  recipientType?: 'individual' | 'group';
  replyToMessageId?: string;
};

export type WhatsAppTextMessageParams = WhatsAppSendMessageBase & {
  type: 'text';
  text: {
    body: string;
    preview_url?: boolean;
  };
};

export type WhatsAppTemplateMessageParams = WhatsAppSendMessageBase & {
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: JsonValue[];
  };
};

export type WhatsAppMediaRef = { id: string } | { link: string };

export type WhatsAppImageMessageParams = WhatsAppSendMessageBase & {
  type: 'image';
  image: WhatsAppMediaRef & { caption?: string };
};

export type WhatsAppVideoMessageParams = WhatsAppSendMessageBase & {
  type: 'video';
  video: WhatsAppMediaRef & { caption?: string };
};

export type WhatsAppAudioMessageParams = WhatsAppSendMessageBase & {
  type: 'audio';
  audio: WhatsAppMediaRef;
};

export type WhatsAppDocumentMessageParams = WhatsAppSendMessageBase & {
  type: 'document';
  document: WhatsAppMediaRef & { caption?: string; filename?: string };
};

export type WhatsAppStickerMessageParams = WhatsAppSendMessageBase & {
  type: 'sticker';
  sticker: WhatsAppMediaRef;
};

export type WhatsAppLocationMessageParams = WhatsAppSendMessageBase & {
  type: 'location';
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
};

export type WhatsAppContactName = {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  prefix?: string;
};

export type WhatsAppContactPhone = {
  phone: string;
  type?: string;
  wa_id?: string;
};

export type WhatsAppContact = {
  name: WhatsAppContactName;
  phones?: WhatsAppContactPhone[];
  emails?: Array<{ email: string; type?: string }>;
  urls?: Array<{ url: string; type?: string }>;
  org?: { company?: string; department?: string; title?: string };
};

export type WhatsAppContactsMessageParams = WhatsAppSendMessageBase & {
  type: 'contacts';
  contacts: WhatsAppContact[];
};

export type WhatsAppInteractiveButtonReply = {
  id: string;
  title: string;
};

export type WhatsAppInteractiveListRow = {
  id: string;
  title: string;
  description?: string;
};

export type WhatsAppInteractiveListSection = {
  title?: string;
  rows: WhatsAppInteractiveListRow[];
};

export type WhatsAppInteractive =
  | {
      type: 'button';
      body: { text: string };
      footer?: { text: string };
      action: { buttons: Array<{ type: 'reply'; reply: WhatsAppInteractiveButtonReply }> };
      header?: {
        type: 'text' | 'image' | 'video' | 'document';
        text?: string;
        image?: WhatsAppMediaRef;
        video?: WhatsAppMediaRef;
        document?: WhatsAppMediaRef & { filename?: string };
      };
    }
  | {
      type: 'list';
      body: { text: string };
      footer?: { text: string };
      action: {
        button: string;
        sections: WhatsAppInteractiveListSection[];
      };
      header?: {
        type: 'text' | 'image' | 'video' | 'document';
        text?: string;
        image?: WhatsAppMediaRef;
        video?: WhatsAppMediaRef;
        document?: WhatsAppMediaRef & { filename?: string };
      };
    }
  | {
      type: 'cta_url';
      body: { text: string };
      footer?: { text: string };
      action: {
        name: 'cta_url';
        parameters: { display_text: string; url: string };
      };
      header?: { type: 'text'; text: string };
    }
  | {
      type: 'location_request_message';
      body: { text: string };
      action: { name: 'send_location' };
    }
  | {
      type: 'flow';
      body: { text: string };
      action: JsonValue;
    };

export type WhatsAppInteractiveMessageParams = WhatsAppSendMessageBase & {
  type: 'interactive';
  interactive: WhatsAppInteractive;
};

export type WhatsAppReactionMessageParams = WhatsAppSendMessageBase & {
  type: 'reaction';
  reaction: { message_id: string; emoji: string };
};

export type WhatsAppMarkAsReadParams = {
  type: 'mark_as_read';
  messagingProduct?: WhatsAppMessagingProduct;
  message_id: string;
};

export type WhatsAppTypingParams = WhatsAppSendMessageBase & {
  type: 'typing';
  action: 'on' | 'off';
};

export type WhatsAppSendMessageParams =
  | WhatsAppTextMessageParams
  | WhatsAppTemplateMessageParams
  | WhatsAppImageMessageParams
  | WhatsAppVideoMessageParams
  | WhatsAppAudioMessageParams
  | WhatsAppDocumentMessageParams
  | WhatsAppStickerMessageParams
  | WhatsAppLocationMessageParams
  | WhatsAppContactsMessageParams
  | WhatsAppInteractiveMessageParams
  | WhatsAppReactionMessageParams
  | WhatsAppMarkAsReadParams
  | WhatsAppTypingParams;

export type WhatsAppSendMessageResult = {
  providerMessageId?: string;
  raw?: JsonValue;
};

export class WhatsAppClient {
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly phoneNumberId: string;
  private readonly baseUrl: string;
  private readonly requestFn: WhatsAppRequestFn;

  /**
   * Creates a WhatsApp Cloud API client bound to a phone number.
   *
   * @param options - Client configuration
   * @throws {WhatsAppValidationError} When required options are missing
   */
  constructor(options: WhatsAppClientOptions) {
    if (!isNonEmptyString(options?.accessToken)) {
      throw new WhatsAppValidationError('WhatsApp accessToken is required');
    }
    if (!isNonEmptyString(options?.apiVersion)) {
      throw new WhatsAppValidationError('WhatsApp apiVersion is required');
    }
    if (!isNonEmptyString(options?.phoneNumberId)) {
      throw new WhatsAppValidationError('WhatsApp phoneNumberId is required');
    }

    this.accessToken = options.accessToken;
    this.apiVersion = options.apiVersion;
    this.phoneNumberId = options.phoneNumberId;
    this.baseUrl = isNonEmptyString(options.baseUrl)
      ? options.baseUrl
      : 'https://graph.facebook.com';
    this.requestFn = options.requestFn ?? defaultRequestFn;
  }

  /**
   * Sends a message (or message-related command) through the WhatsApp `/messages` endpoint.
   *
   * @param params - Message parameters
   * @returns The raw API response plus `providerMessageId` when available
   * @throws {WhatsAppValidationError} When required fields are missing
   * @throws {WhatsAppApiError} When the Graph API returns a non-2xx response
   */
  async sendMessage(params: WhatsAppSendMessageParams): Promise<WhatsAppSendMessageResult> {
    const messagingProduct: WhatsAppMessagingProduct =
      (params as WhatsAppSendMessageBase).messagingProduct ?? 'whatsapp';

    const url = buildGraphUrl(
      this.baseUrl,
      this.apiVersion,
      `${this.phoneNumberId}/messages`,
    );

    const body = this.buildSendMessageBody(params, messagingProduct);

    const response = await this.requestFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await readJsonSafely(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp Graph API request failed', {
        statusCode: response.statusCode,
        raw,
        responseBody: raw,
      });
    }

    return { providerMessageId: extractProviderMessageId(raw), raw };
  }

  /**
   * Sends a plain text message.
   *
   * @param params - Text message parameters
   * @returns Provider message id plus raw API response
   * @throws {WhatsAppValidationError} When required fields are missing
   * @throws {WhatsAppApiError} When the Graph API returns a non-2xx response
   */
  async sendTextMessage(params: {
    to: string;
    text: string;
    messagingProduct?: WhatsAppMessagingProduct;
  }): Promise<{ providerMessageId: string; raw?: JsonValue }> {
    if (!isNonEmptyString(params?.to)) {
      throw new WhatsAppValidationError('WhatsApp to is required');
    }
    if (!isNonEmptyString(params?.text)) {
      throw new WhatsAppValidationError('WhatsApp text is required');
    }

    const result = await this.sendMessage({
      type: 'text',
      to: params.to,
      messagingProduct: params.messagingProduct,
      text: { body: params.text },
    });

    if (!isNonEmptyString(result.providerMessageId)) {
      throw new WhatsAppApiError('WhatsApp API response missing messages[0].id', {
        raw: result.raw,
        responseBody: result.raw,
      });
    }

    return { providerMessageId: result.providerMessageId, raw: result.raw };
  }

  /**
   * Sends a template message.
   *
   * @param params - Template message parameters
   * @returns Provider message id plus raw API response
   * @throws {WhatsAppValidationError} When required fields are missing
   * @throws {WhatsAppApiError} When the Graph API returns a non-2xx response
   */
  async sendTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode: string;
    components?: JsonValue[];
    messagingProduct?: WhatsAppMessagingProduct;
  }): Promise<{ providerMessageId: string; raw?: JsonValue }> {
    if (!isNonEmptyString(params?.to)) {
      throw new WhatsAppValidationError('WhatsApp to is required');
    }
    if (!isNonEmptyString(params?.templateName)) {
      throw new WhatsAppValidationError('WhatsApp templateName is required');
    }
    if (!isNonEmptyString(params?.languageCode)) {
      throw new WhatsAppValidationError('WhatsApp languageCode is required');
    }

    const result = await this.sendMessage({
      type: 'template',
      to: params.to,
      messagingProduct: params.messagingProduct,
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        ...(Array.isArray(params.components) && params.components.length > 0
          ? { components: params.components }
          : {}),
      },
    });

    if (!isNonEmptyString(result.providerMessageId)) {
      throw new WhatsAppApiError('WhatsApp API response missing messages[0].id', {
        raw: result.raw,
        responseBody: result.raw,
      });
    }

    return { providerMessageId: result.providerMessageId, raw: result.raw };
  }

  private buildSendMessageBody(
    params: WhatsAppSendMessageParams,
    messagingProduct: WhatsAppMessagingProduct,
  ): JsonValue {
    if (params.type === 'mark_as_read') {
      if (!isNonEmptyString(params.message_id)) {
        throw new WhatsAppValidationError('WhatsApp message_id is required');
      }

      return {
        messaging_product: messagingProduct,
        status: 'read',
        message_id: params.message_id,
      };
    }

    if (params.type === 'typing') {
      if (!isNonEmptyString(params?.to)) {
        throw new WhatsAppValidationError('WhatsApp to is required');
      }

      const typingType: 'typing_on' | 'typing_off' =
        params.action === 'on' ? 'typing_on' : 'typing_off';

      const body: Record<string, JsonValue> = {
        messaging_product: messagingProduct,
        to: params.to,
        type: typingType,
      };

      if (isNonEmptyString(params.recipientType)) {
        body.recipient_type = params.recipientType;
      }

      return body;
    }

    if (!isNonEmptyString(params?.to)) {
      throw new WhatsAppValidationError('WhatsApp to is required');
    }

    const base: Record<string, JsonValue> = {
      messaging_product: messagingProduct,
      to: params.to,
      type: params.type,
    };

    if (isNonEmptyString(params.recipientType)) {
      base.recipient_type = params.recipientType;
    }

    if (isNonEmptyString(params.replyToMessageId)) {
      base.context = { message_id: params.replyToMessageId };
    }

    base[params.type] = (params as never)[params.type] as JsonValue;
    return base;
  }
}

function extractProviderMessageId(raw: JsonValue | undefined): string | undefined {
  if (!isJsonObject(raw)) return undefined;

  const messages = raw['messages'];
  if (!isJsonArray(messages)) return undefined;

  const first = messages[0];
  if (!isJsonObject(first)) return undefined;

  const id = first['id'];
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}
