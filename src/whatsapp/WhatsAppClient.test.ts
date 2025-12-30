import { WhatsAppClient } from './WhatsAppClient';

import type { JsonValue } from './Json';
import type {
    WhatsAppRequestFn,
    WhatsAppRequestInit,
    WhatsAppResponse,
} from './WhatsAppRequest';

function createMockResponse(statusCode: number, json: JsonValue): WhatsAppResponse {
  return {
    statusCode,
    body: {
      json: async () => json,
      text: async () => JSON.stringify(json),
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(json)).buffer,
    },
  };
}

describe('WhatsAppClient', () => {
  it('should send text message and return providerMessageId', async () => {
    const requestFn: WhatsAppRequestFn = async () =>
      createMockResponse(200, {
        messages: [{ id: 'wamid.TEST' }],
      });

    const client = new WhatsAppClient({
      apiVersion: 'v21.0',
      phoneNumberId: '123',
      accessToken: 'token',
      requestFn,
    });

    const result = await client.sendTextMessage({
      to: '5511999999999',
      text: 'Hello',
    });

    expect(result.providerMessageId).toBe('wamid.TEST');
  });

  it('should send template message with language code', async () => {
    const calls: Array<{ init: WhatsAppRequestInit }> = [];

    const requestFn: WhatsAppRequestFn = async (_url, init) => {
      calls.push({ init });

      return createMockResponse(200, {
        messages: [{ id: 'wamid.TEMPLATE' }],
      });
    };

    const client = new WhatsAppClient({
      apiVersion: 'v21.0',
      phoneNumberId: '123',
      accessToken: 'token',
      requestFn,
    });

    const result = await client.sendTemplateMessage({
      to: '5511999999999',
      templateName: 'hello_world',
      languageCode: 'pt_BR',
    });

    expect(result.providerMessageId).toBe('wamid.TEMPLATE');

    const firstCall = calls[0];
    expect(firstCall).toBeDefined();

    const body = JSON.parse(String(firstCall?.init.body));
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('hello_world');
    expect(body.template.language.code).toBe('pt_BR');
  });

  it('should throw when response is not 2xx', async () => {
    const requestFn: WhatsAppRequestFn = async () =>
      createMockResponse(500, { error: { message: 'fail' } });

    const client = new WhatsAppClient({
      apiVersion: 'v21.0',
      phoneNumberId: '123',
      accessToken: 'token',
      requestFn,
    });

    await expect(
      client.sendTextMessage({
        to: '5511999999999',
        text: 'Hello',
      }),
    ).rejects.toThrow('WhatsApp Graph API request failed');
  });
});
