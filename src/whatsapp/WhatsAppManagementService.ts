import type { JsonValue } from './Json.js';
import { isJsonArray, isJsonObject } from './Json.js';
import { WhatsAppApiError, WhatsAppValidationError } from './WhatsAppErrors.js';
import {
  defaultRequestFn,
  readJsonSafely,
  type WhatsAppRequestFn,
} from './WhatsAppRequest.js';
import { buildGraphUrl, isNonEmptyString } from './whatsAppUtils.js';

declare const __whatsAppStringBrand: unique symbol;
type WhatsAppExtensibleString = string & { readonly [__whatsAppStringBrand]: never };

export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type WhatsAppTemplateStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'
  | WhatsAppExtensibleString;

export type WhatsAppMessageTemplateComponent = {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | WhatsAppExtensibleString;
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | WhatsAppExtensibleString;
  text?: string;
  example?: JsonValue;
  buttons?: JsonValue[];
};

export type WhatsAppMessageTemplate = {
  id?: string;
  name: string;
  language: string;
  category?: WhatsAppTemplateCategory;
  status?: WhatsAppTemplateStatus;
  components: WhatsAppMessageTemplateComponent[];
};

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

export type CreateMessageTemplateBody = {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  components: WhatsAppMessageTemplateComponent[];
};

export type CreateMessageTemplateResult = {
  id?: string;
  name?: string;
  status?: WhatsAppTemplateStatus;
  category?: WhatsAppTemplateCategory;
  language?: string;
  raw: JsonValue | undefined;
};

export type UpdateMessageTemplateBody = {
  category?: WhatsAppTemplateCategory;
  components?: WhatsAppMessageTemplateComponent[];
};

export type DeleteMessageTemplateResult = {
  success: boolean;
  raw: JsonValue | undefined;
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

  private async requestJson(
    url: string,
    init: { method: string; body?: JsonValue },
  ): Promise<JsonValue | undefined> {
    const body = init.body === undefined ? undefined : JSON.stringify(init.body);

    const response = await this.requestFn(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });
  
    const responseBody = await readJsonSafely(response.body);
  
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp Graph API request failed', {
        statusCode: response.statusCode,
        raw: responseBody,
      });
    }
  
    return responseBody;
  }

  private static parsePaging(
    raw: JsonValue | undefined,
  ):
    | {
        cursors?: { before?: string; after?: string };
        next?: string;
      }
    | undefined {
    if (!isJsonObject(raw)) return undefined;

    const pagingValue = raw['paging'];
    if (!isJsonObject(pagingValue)) return undefined;

    const cursorsValue = pagingValue['cursors'];
    const nextValue = pagingValue['next'];

    const cursors = isJsonObject(cursorsValue) ? cursorsValue : undefined;

    return {
      cursors:
        cursors
          ? {
              before: isNonEmptyString(cursors['before'])
                ? String(cursors['before'])
                : undefined,
              after: isNonEmptyString(cursors['after'])
                ? String(cursors['after'])
                : undefined,
            }
          : undefined,
      next: isNonEmptyString(nextValue) ? String(nextValue) : undefined,
    };
  }

  private async resolveTemplateId(
    wabaId: string,
    templateNameOrId: string,
  ): Promise<string | null> {
    if (/^\d+$/.test(templateNameOrId)) return templateNameOrId;

    const result = await this.listMessageTemplates({
      wabaId,
      name: templateNameOrId,
      fields: ['id', 'name'],
      limit: 1,
    });

    const match = result.templates.find((t) => t?.id && t?.name === templateNameOrId);
    return match?.id ? String(match.id) : null;
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

    const dataValue = isJsonObject(body) ? body['data'] : undefined;
    const data = isJsonArray(dataValue) ? dataValue : [];
  
    const templates: MessageTemplateSummary[] = data.map((item) => {
      if (!isJsonObject(item)) return {};

      return {
        id: isNonEmptyString(item['id']) ? String(item['id']) : undefined,
        name: isNonEmptyString(item['name']) ? String(item['name']) : undefined,
        category: isNonEmptyString(item['category'])
          ? String(item['category'])
          : undefined,
        status: isNonEmptyString(item['status']) ? String(item['status']) : undefined,
      };
    });
  
    const paging = WhatsAppManagementClient.parsePaging(body);

    return { templates, paging, raw: body };
  }

  async createMessageTemplate(
    wabaId: string,
    body: CreateMessageTemplateBody,
  ): Promise<CreateMessageTemplateResult> {
    if (!isNonEmptyString(wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }

    if (!isNonEmptyString(body?.name)) {
      throw new WhatsAppValidationError('WhatsApp template name is required');
    }

    if (!isNonEmptyString(body?.language)) {
      throw new WhatsAppValidationError('WhatsApp template language is required');
    }

    if (!isNonEmptyString(body?.category)) {
      throw new WhatsAppValidationError('WhatsApp template category is required');
    }

    if (!Array.isArray(body?.components) || body.components.length === 0) {
      throw new WhatsAppValidationError('WhatsApp template components are required');
    }

    const url = buildGraphUrl(
      this.baseUrl,
      this.apiVersion,
      `${wabaId}/message_templates`,
    );

    const raw = await this.requestJson(url, { method: 'POST', body });
    const parsed = isJsonObject(raw) ? raw : undefined;

    return {
      id: isNonEmptyString(parsed?.['id']) ? String(parsed?.['id']) : undefined,
      name: isNonEmptyString(parsed?.['name']) ? String(parsed?.['name']) : undefined,
      status: isNonEmptyString(parsed?.['status'])
        ? (String(parsed?.['status']) as WhatsAppTemplateStatus)
        : undefined,
      category: isNonEmptyString(parsed?.['category'])
        ? (String(parsed?.['category']) as WhatsAppTemplateCategory)
        : undefined,
      language: isNonEmptyString(parsed?.['language'])
        ? String(parsed?.['language'])
        : undefined,
      raw,
    };
  }

  async updateMessageTemplate(
    wabaId: string,
    templateNameOrId: string,
    body: UpdateMessageTemplateBody,
  ): Promise<CreateMessageTemplateResult> {
    if (!isNonEmptyString(wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }

    if (!isNonEmptyString(templateNameOrId)) {
      throw new WhatsAppValidationError('WhatsApp template id or name is required');
    }

    const templateId = await this.resolveTemplateId(wabaId, templateNameOrId);
    if (!templateId) {
      throw new WhatsAppValidationError('WhatsApp template was not found');
    }

    const url = buildGraphUrl(this.baseUrl, this.apiVersion, templateId);
    const raw = await this.requestJson(url, { method: 'POST', body });

    const parsed = isJsonObject(raw) ? raw : undefined;
    return {
      id: isNonEmptyString(parsed?.['id']) ? String(parsed?.['id']) : undefined,
      name: isNonEmptyString(parsed?.['name']) ? String(parsed?.['name']) : undefined,
      status: isNonEmptyString(parsed?.['status'])
        ? (String(parsed?.['status']) as WhatsAppTemplateStatus)
        : undefined,
      category: isNonEmptyString(parsed?.['category'])
        ? (String(parsed?.['category']) as WhatsAppTemplateCategory)
        : undefined,
      language: isNonEmptyString(parsed?.['language'])
        ? String(parsed?.['language'])
        : undefined,
      raw,
    };
  }

  async deleteMessageTemplate(
    wabaId: string,
    templateNameOrId: string,
  ): Promise<DeleteMessageTemplateResult> {
    if (!isNonEmptyString(wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }

    if (!isNonEmptyString(templateNameOrId)) {
      throw new WhatsAppValidationError('WhatsApp template id or name is required');
    }

    const templateId = await this.resolveTemplateId(wabaId, templateNameOrId);
    if (!templateId) {
      throw new WhatsAppValidationError('WhatsApp template was not found');
    }

    const url = buildGraphUrl(this.baseUrl, this.apiVersion, templateId);
    const raw = await this.requestJson(url, { method: 'DELETE' });

    const parsed = isJsonObject(raw) ? raw : undefined;
    return {
      success: parsed?.['success'] === true,
      raw,
    };
  }

  async getMessageTemplate(
    wabaId: string,
    templateNameOrId: string,
  ): Promise<WhatsAppMessageTemplate | null> {
    if (!isNonEmptyString(wabaId)) {
      throw new WhatsAppValidationError('WhatsApp WABA ID is required');
    }

    if (!isNonEmptyString(templateNameOrId)) {
      throw new WhatsAppValidationError('WhatsApp template id or name is required');
    }

    const templateId = await this.resolveTemplateId(wabaId, templateNameOrId);
    if (!templateId) return null;

    const url = buildGraphUrl(this.baseUrl, this.apiVersion, templateId);
    const raw = await this.requestJson(url, { method: 'GET' });

    const parsed = isJsonObject(raw) ? raw : undefined;
    const componentsValue = parsed?.['components'];
    const components = isJsonArray(componentsValue)
      ? componentsValue
          .filter(isJsonObject)
          .map((component): WhatsAppMessageTemplateComponent => {
            const typeValue = component['type'];
            return {
              type: isNonEmptyString(typeValue)
                ? (String(typeValue) as WhatsAppMessageTemplateComponent['type'])
                : 'BODY',
              format: isNonEmptyString(component['format'])
                ? (String(component['format']) as WhatsAppMessageTemplateComponent['format'])
                : undefined,
              text: isNonEmptyString(component['text']) ? String(component['text']) : undefined,
              example: component['example'],
              buttons: isJsonArray(component['buttons']) ? component['buttons'] : undefined,
            };
          })
      : [];

    const name = isNonEmptyString(parsed?.['name'])
      ? String(parsed?.['name'])
      : templateNameOrId;

    const language = isNonEmptyString(parsed?.['language'])
      ? String(parsed?.['language'])
      : 'pt_BR';

    if (!isNonEmptyString(name) || !isNonEmptyString(language)) return null;

    return {
      id: templateId,
      name,
      language,
      category: isNonEmptyString(parsed?.['category'])
        ? (String(parsed?.['category']) as WhatsAppTemplateCategory)
        : undefined,
      status: isNonEmptyString(parsed?.['status'])
        ? (String(parsed?.['status']) as WhatsAppTemplateStatus)
        : undefined,
      components,
    };
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

    const dataValue = isJsonObject(body) ? body['data'] : undefined;
    const data = isJsonArray(dataValue) ? dataValue : [];
  
    const phoneNumbers: PhoneNumberSummary[] = data.map((item) => {
      if (!isJsonObject(item)) return {};

      return {
        id: isNonEmptyString(item['id']) ? String(item['id']) : undefined,
        displayPhoneNumber: isNonEmptyString(item['display_phone_number'])
          ? String(item['display_phone_number'])
          : undefined,
        verifiedName: isNonEmptyString(item['verified_name'])
          ? String(item['verified_name'])
          : undefined,
        status: isNonEmptyString(item['status']) ? String(item['status']) : undefined,
      };
    });
  
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
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
  raw: JsonValue | undefined;
};

export type PhoneNumberSummary = {
  id?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  status?: string;
};

export type ListPhoneNumbersResult = {
  phoneNumbers: PhoneNumberSummary[];
  raw: JsonValue | undefined;
};

export type GetWabaFieldsResult = {
  raw: JsonValue | undefined;
};
