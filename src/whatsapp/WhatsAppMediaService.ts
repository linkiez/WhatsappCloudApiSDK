import { Blob, Buffer } from 'node:buffer';
import { FormData } from 'undici';

import { WhatsAppApiError, WhatsAppValidationError } from './WhatsAppErrors.js';
import {
    defaultRequestFn,
    readJsonSafely,
    type WhatsAppRequestFn,
} from './WhatsAppRequest.js';
import { buildGraphUrl, isNonEmptyString } from './whatsAppUtils.js';

export type WhatsAppMediaClientOptions = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  baseUrl?: string;
  requestFn?: WhatsAppRequestFn;
};

export type UploadWhatsAppMediaParams = {
  fileName: string;
  contentType: string;
  content: Uint8Array;
};

export type GetWhatsAppMediaUrlParams = {
  mediaId: string;
};

export type DownloadWhatsAppMediaParams = {
  mediaUrl: string;
};

export type DeleteWhatsAppMediaParams = {
  mediaId: string;
};

export default class WhatsAppMediaClient {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly requestFn: WhatsAppRequestFn;

  constructor(options: WhatsAppMediaClientOptions) {
    if (!isNonEmptyString(options?.accessToken)) {
      throw new WhatsAppValidationError('WhatsApp accessToken is required');
    }

    if (!isNonEmptyString(options?.phoneNumberId)) {
      throw new WhatsAppValidationError('WhatsApp phoneNumberId is required');
    }

    this.accessToken = options.accessToken;
    this.phoneNumberId = options.phoneNumberId;
    this.apiVersion = isNonEmptyString(options.apiVersion)
      ? options.apiVersion
      : 'v20.0';
    this.baseUrl = isNonEmptyString(options.baseUrl)
      ? options.baseUrl
      : 'https://graph.facebook.com';
    this.requestFn = options.requestFn ?? defaultRequestFn;
  }

  async uploadMedia(
    params: UploadWhatsAppMediaParams,
  ): Promise<{ mediaId: string }> {
    if (!isNonEmptyString(params.fileName)) {
      throw new WhatsAppValidationError('fileName is required');
    }

    if (!isNonEmptyString(params.contentType)) {
      throw new WhatsAppValidationError('contentType is required');
    }

    if (!params.content || params.content.length === 0) {
      throw new WhatsAppValidationError('content is required');
    }

    const url = buildGraphUrl(
      this.baseUrl,
      this.apiVersion,
      `${this.phoneNumberId}/media`,
    );

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', params.contentType);
    const blob = new Blob([Buffer.from(params.content)], {
      type: params.contentType,
    });
    form.append('file', blob, params.fileName);

    const response = await this.requestFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: form,
    });

    const body = await readJsonSafely(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp media upload failed', {
        statusCode: response.statusCode,
        responseBody: body,
      });
    }

    const mediaId = (() => {
      const parsed = body as { id?: unknown };
      return isNonEmptyString(parsed?.id) ? String(parsed.id) : undefined;
    })();

    if (!mediaId) {
      throw new WhatsAppApiError('WhatsApp media upload returned invalid body', {
        responseBody: body,
      });
    }

    return { mediaId };
  }

  async getMediaUrl(
    params: GetWhatsAppMediaUrlParams,
  ): Promise<{ url: string; raw?: unknown }> {
    if (!isNonEmptyString(params.mediaId)) {
      throw new WhatsAppValidationError('mediaId is required');
    }

    const url = buildGraphUrl(this.baseUrl, this.apiVersion, params.mediaId);

    const response = await this.requestFn(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await readJsonSafely(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp get media url failed', {
        statusCode: response.statusCode,
        responseBody: body,
      });
    }

    const mediaUrl = (() => {
      const parsed = body as { url?: unknown };
      return isNonEmptyString(parsed?.url) ? String(parsed.url) : undefined;
    })();

    if (!mediaUrl) {
      throw new WhatsAppApiError('WhatsApp get media url returned invalid body', {
        responseBody: body,
      });
    }

    return { url: mediaUrl, raw: body };
  }

  async downloadMedia(
    params: DownloadWhatsAppMediaParams,
  ): Promise<{ content: Uint8Array }> {
    if (!isNonEmptyString(params.mediaUrl)) {
      throw new WhatsAppValidationError('mediaUrl is required');
    }

    const response = await this.requestFn(params.mediaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const body = await readJsonSafely(response.body);
      throw new WhatsAppApiError('WhatsApp download media failed', {
        statusCode: response.statusCode,
        responseBody: body,
      });
    }

    const bytes = await response.body.arrayBuffer();
    return { content: new Uint8Array(bytes) };
  }

  async deleteMedia(params: DeleteWhatsAppMediaParams): Promise<void> {
    if (!isNonEmptyString(params.mediaId)) {
      throw new WhatsAppValidationError('mediaId is required');
    }

    const url = buildGraphUrl(this.baseUrl, this.apiVersion, params.mediaId);

    const response = await this.requestFn(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const body = await readJsonSafely(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp delete media failed', {
        statusCode: response.statusCode,
        responseBody: body,
      });
    }
  }
}
