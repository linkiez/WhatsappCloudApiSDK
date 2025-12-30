import { WhatsAppApiError, WhatsAppValidationError } from './WhatsAppErrors';
import WhatsAppManagementClient from './WhatsAppManagementService';

import type { JsonValue } from './Json';
import type {
    WhatsAppRequestFn,
    WhatsAppRequestInit,
    WhatsAppResponse,
} from './WhatsAppRequest';

function createMockResponse(statusCode: number, json: JsonValue): WhatsAppResponse {
  const jsonText = JSON.stringify(json);
  return {
    statusCode,
    body: {
      json: async () => json,
      text: async () => jsonText,
      arrayBuffer: async () => new TextEncoder().encode(jsonText).buffer,
    },
  };
}

describe('WhatsAppManagementClient', () => {
  it('should list message templates', async () => {
    const calls: Array<{ url: string; init: WhatsAppRequestInit }> = [];

    const requestFn: WhatsAppRequestFn = async (url, init) => {
      calls.push({ url: String(url), init });
      return createMockResponse(200, {
        data: [
          {
            id: 'tmpl_1',
            name: 'reservation_confirmation',
            category: 'UTILITY',
            status: 'APPROVED',
          },
        ],
      });
    };

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.listMessageTemplates({
      wabaId: '102290129340398',
      fields: ['name', 'category', 'status'],
      limit: 5,
    });

    expect(result.templates).toEqual([
      {
        id: 'tmpl_1',
        name: 'reservation_confirmation',
        category: 'UTILITY',
        status: 'APPROVED',
      },
    ]);

    expect(calls[0]?.url).toBe(
      'https://graph.facebook.com/v20.0/102290129340398/message_templates?fields=name%2Ccategory%2Cstatus&limit=5',
    );
    expect(calls[0]?.init.headers?.Authorization).toBe('Bearer token');
  });

  it('should list phone numbers', async () => {
    const requestFn: WhatsAppRequestFn = async () =>
      createMockResponse(200, {
        data: [
          {
            id: 'phone_1',
            display_phone_number: '5511999999999',
            verified_name: 'My Business',
            status: 'CONNECTED',
          },
        ],
      });

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.listPhoneNumbers({
      wabaId: '102290129340398',
      fields: ['display_phone_number', 'verified_name', 'status'],
    });

    expect(result.phoneNumbers).toEqual([
      {
        id: 'phone_1',
        displayPhoneNumber: '5511999999999',
        verifiedName: 'My Business',
        status: 'CONNECTED',
      },
    ]);
  });

  it('should throw WhatsAppValidationError when WABA id is missing', async () => {
    const client = new WhatsAppManagementClient({ accessToken: 'token' });

    await expect(
      client.listMessageTemplates({
        wabaId: '',
      }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('should create a message template', async () => {
    const calls: Array<{ url: string; init: WhatsAppRequestInit }> = [];

    const requestFn: WhatsAppRequestFn = async (url, init) => {
      calls.push({ url: String(url), init });
      return createMockResponse(200, {
        id: '123456',
        name: 'reservation_confirmation',
        status: 'PENDING',
        category: 'UTILITY',
        language: 'pt_BR',
      });
    };

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.createMessageTemplate('102290129340398', {
      name: 'reservation_confirmation',
      language: 'pt_BR',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Olá' }],
    });

    expect(result.id).toBe('123456');
    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) throw new Error('missing request call');

    expect(firstCall.url).toBe(
      'https://graph.facebook.com/v20.0/102290129340398/message_templates',
    );
    expect(firstCall.init.method).toBe('POST');
    expect(firstCall.init.headers?.Authorization).toBe('Bearer token');
    expect(JSON.parse(String(firstCall.init.body))).toEqual({
      name: 'reservation_confirmation',
      language: 'pt_BR',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Olá' }],
    });
  });

  it('should update a message template by name (resolve id via list)', async () => {
    const calls: Array<{ url: string; init: WhatsAppRequestInit }> = [];

    const requestFn: WhatsAppRequestFn = async (url, init) => {
      const asString = String(url);
      calls.push({ url: asString, init });

      if (asString.includes('/message_templates?')) {
        return createMockResponse(200, {
          data: [{ id: '999999', name: 'reservation_confirmation' }],
        });
      }

      return createMockResponse(200, { id: '999999', status: 'APPROVED' });
    };

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.updateMessageTemplate(
      '102290129340398',
      'reservation_confirmation',
      { category: 'MARKETING' },
    );

    expect(result.id).toBe('999999');
    expect(calls).toHaveLength(2);
    const firstCall = calls[0];
    const secondCall = calls[1];
    if (!firstCall || !secondCall) throw new Error('missing request calls');

    expect(firstCall.url).toBe(
      'https://graph.facebook.com/v20.0/102290129340398/message_templates?fields=id%2Cname&limit=1&name=reservation_confirmation',
    );
    expect(secondCall.url).toBe('https://graph.facebook.com/v20.0/999999');
    expect(secondCall.init.method).toBe('POST');
    expect(JSON.parse(String(secondCall.init.body))).toEqual({
      category: 'MARKETING',
    });
  });

  it('should delete a message template by id (no list call)', async () => {
    const calls: Array<{ url: string; init: WhatsAppRequestInit }> = [];

    const requestFn: WhatsAppRequestFn = async (url, init) => {
      calls.push({ url: String(url), init });
      return createMockResponse(200, { success: true });
    };

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.deleteMessageTemplate('102290129340398', '123456');

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) throw new Error('missing request call');
    expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/123456');
    expect(firstCall.init.method).toBe('DELETE');
  });

  it('should get a message template by name', async () => {
    const requestFn: WhatsAppRequestFn = async (url, init) => {
      const asString = String(url);

      if (asString.includes('/message_templates?')) {
        return createMockResponse(200, {
          data: [{ id: '999999', name: 'reservation_confirmation' }],
        });
      }

      return createMockResponse(200, {
        id: '999999',
        name: 'reservation_confirmation',
        language: 'pt_BR',
        category: 'UTILITY',
        status: 'APPROVED',
        components: [{ type: 'BODY', text: 'Olá' }],
      });
    };

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    const template = await client.getMessageTemplate(
      '102290129340398',
      'reservation_confirmation',
    );

    expect(template).toEqual({
      id: '999999',
      name: 'reservation_confirmation',
      language: 'pt_BR',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [{ type: 'BODY', text: 'Olá' }],
    });
  });

  it('should map Graph API errors to WhatsAppApiError with errorCode/errorSubcode', async () => {
    const requestFn: WhatsAppRequestFn = async () =>
      createMockResponse(400, {
        error: {
          message: 'Invalid OAuth access token.',
          type: 'OAuthException',
          code: 190,
          error_subcode: 463,
        },
      });

    const client = new WhatsAppManagementClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      requestFn,
    });

    try {
      await client.listMessageTemplates({ wabaId: '102290129340398' });
      throw new Error('expected error');
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppApiError);
      const casted = error as WhatsAppApiError;
      expect(casted.statusCode).toBe(400);
      expect(casted.errorCode).toBe(190);
      expect(casted.errorSubcode).toBe(463);
      expect(casted.raw).toEqual({
        error: {
          message: 'Invalid OAuth access token.',
          type: 'OAuthException',
          code: 190,
          error_subcode: 463,
        },
      });
    }
  });
});
