import { request } from 'undici';

export type WhatsAppClientOptions = {
  baseUrl?: string;
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  requestFn?: typeof request;
};

export class WhatsAppClient {
  private readonly baseUrl: string;
  private readonly requestFn: typeof request;

  constructor(private readonly options: WhatsAppClientOptions) {
    this.baseUrl = options.baseUrl ?? 'https://graph.facebook.com';
    this.requestFn = options.requestFn ?? request;
  }

  async sendTextMessage(params: {
    to: string;
    text: string;
    messagingProduct?: 'whatsapp';
  }): Promise<{
    providerMessageId: string;
    raw: unknown;
  }> {
    const messagingProduct = params.messagingProduct ?? 'whatsapp';

    const url = new URL(
      `${this.options.apiVersion}/${this.options.phoneNumberId}/messages`,
      this.baseUrl,
    );

    const body = {
      messaging_product: messagingProduct,
      to: params.to,
      type: 'text',
      text: { body: params.text },
    };

    const response = await this.requestFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await response.body.json();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`WhatsApp API error: ${response.statusCode}`);
    }

    const providerMessageId = (raw as any)?.messages?.[0]?.id;
    if (typeof providerMessageId !== 'string' || providerMessageId.length === 0) {
      throw new Error('WhatsApp API response missing messages[0].id');
    }

    return { providerMessageId, raw };
  }

  async sendTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode: string;
    components?: unknown[];
    messagingProduct?: 'whatsapp';
  }): Promise<{
    providerMessageId: string;
    raw: unknown;
  }> {
    const messagingProduct = params.messagingProduct ?? 'whatsapp';

    const url = new URL(
      `${this.options.apiVersion}/${this.options.phoneNumberId}/messages`,
      this.baseUrl,
    );

    const body: any = {
      messaging_product: messagingProduct,
      to: params.to,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        ...(Array.isArray(params.components) && params.components.length
          ? { components: params.components }
          : {}),
      },
    };

    const response = await this.requestFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await response.body.json();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`WhatsApp API error: ${response.statusCode}`);
    }

    const providerMessageId = (raw as any)?.messages?.[0]?.id;
    if (typeof providerMessageId !== 'string' || providerMessageId.length === 0) {
      throw new Error('WhatsApp API response missing messages[0].id');
    }

    return { providerMessageId, raw };
  }
}
