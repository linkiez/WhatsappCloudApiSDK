import { WhatsAppApiError, WhatsAppValidationError } from './WhatsAppErrors.js';
import {
    defaultRequestFn,
    readJsonSafely,
    type WhatsAppRequestFn,
} from './WhatsAppRequest.js';
import { buildGraphUrl, isNonEmptyString } from './whatsAppUtils.js';

export type WhatsAppManagementClientOptions = {
  accessToken: string;
  apiVersion?: string;
  baseUrl?: string;
  requestFn?: WhatsAppRequestFn;
};

export type ListMessageTemplatesParams = {
  wabaId: string;
  fields?: string[];
  limit?: number;
  name?: string;
  status?: string;
};

export type ListPhoneNumbersParams = {
  wabaId: string;
  fields?: string[];
};

export type GetWabaFieldsParams = {
   wabaId: string;
   fields: string[];
 };

export default class WhatsAppManagementClient {
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly requestFn: WhatsAppRequestFn;
  
  constructor(options: WhatsAppManagementClientOptions) {
    if (!isNonEmptyString(options?.accessToken)) {
      throw new WhatsAppValidationError('WhatsApp accessToken is required');
    }
  
    this.accessToken = options.accessToken;
    this.apiVersion = isNonEmptyString(options.apiVersion)
      ? options.apiVersion
      : 'v20.0';
    this.baseUrl = isNonEmptyString(options.baseUrl)
      ? options.baseUrl
      : 'https://graph.facebook.com';
    this.requestFn = options.requestFn ?? defaultRequestFn;
  }

  private async requestJson(url: string, init: { method: string }): Promise<unknown> {
    const response = await this.requestFn(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  
    const responseBody = await readJsonSafely(response.body);
  
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp Graph API request failed', {
        statusCode: response.statusCode,
        responseBody,
      });
    }
  
    return responseBody;
  }

  async listMessageTemplates(
    params: ListMessageTemplatesParams,
  ): Promise<ListMessageTemplatesResult> {
    if (!isNonEmptyString(params?.wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }
  
    const url = buildGraphUrl(
      this.baseUrl,
      this.apiVersion,
      `${params.wabaId}/message_templates`,
      {
        fields:
          params.fields && params.fields.length > 0
            ? params.fields.join(',')
            : undefined,
        limit:
          typeof params.limit === 'number' && Number.isFinite(params.limit)
            ? String(params.limit)
            : undefined,
        name: isNonEmptyString(params.name) ? params.name : undefined,
        status: isNonEmptyString(params.status) ? params.status : undefined,
      },
    );
  
    const body = await this.requestJson(url, { method: 'GET' });

    const parsed = body as { data?: Array<Record<string, unknown>> };
    const data = Array.isArray(parsed?.data) ? parsed.data : [];
  
    const templates: MessageTemplateSummary[] = data.map((item) => ({
      id: isNonEmptyString(item?.id) ? String(item.id) : undefined,
      name: isNonEmptyString(item?.name) ? String(item.name) : undefined,
      category: isNonEmptyString(item?.category)
        ? String(item.category)
        : undefined,
      status: isNonEmptyString(item?.status) ? String(item.status) : undefined,
    }));
  
    return { templates, raw: body };
  }

  async listPhoneNumbers(
    params: ListPhoneNumbersParams,
  ): Promise<ListPhoneNumbersResult> {
    if (!isNonEmptyString(params?.wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }
  
    const url = buildGraphUrl(
      this.baseUrl,
      this.apiVersion,
      `${params.wabaId}/phone_numbers`,
      {
        fields:
          params.fields && params.fields.length > 0
            ? params.fields.join(',')
            : undefined,
      },
    );
  
    const body = await this.requestJson(url, { method: 'GET' });

    const parsed = body as { data?: Array<Record<string, unknown>> };
    const data = Array.isArray(parsed?.data) ? parsed.data : [];
  
    const phoneNumbers: PhoneNumberSummary[] = data.map((item) => ({
      id: isNonEmptyString(item?.id) ? String(item.id) : undefined,
      displayPhoneNumber: isNonEmptyString(item?.display_phone_number)
        ? String(item.display_phone_number)
        : undefined,
      verifiedName: isNonEmptyString(item?.verified_name)
        ? String(item.verified_name)
        : undefined,
      status: isNonEmptyString(item?.status) ? String(item.status) : undefined,
    }));
  
    return { phoneNumbers, raw: body };
  }

  async getWabaFields(
    params: GetWabaFieldsParams,
  ): Promise<GetWabaFieldsResult> {
    if (!isNonEmptyString(params?.wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }
  
    if (!Array.isArray(params.fields) || params.fields.length === 0) {
      throw new WhatsAppValidationError('WhatsApp fields are required');
    }
  
    const url = buildGraphUrl(this.baseUrl, this.apiVersion, params.wabaId, {
      fields: params.fields.join(','),
    });
  
    const body = await this.requestJson(url, { method: 'GET' });
  
    return { raw: body };
  }

}

export type MessageTemplateSummary = {
  id?: string;
  name?: string;
  category?: string;
  status?: string;
};

export type ListMessageTemplatesResult = {
  templates: MessageTemplateSummary[];
  raw: unknown;
};

export type PhoneNumberSummary = {
  id?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  status?: string;
};

export type ListPhoneNumbersResult = {
  phoneNumbers: PhoneNumberSummary[];
  raw: unknown;
};

export type GetWabaFieldsResult = {
  raw: unknown;
};
