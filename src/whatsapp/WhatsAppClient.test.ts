import { WhatsAppClient } from './WhatsAppClient';

describe('WhatsAppClient', () => {
  it('should send text message and return providerMessageId', async () => {
    const requestFn = async () => {
      return {
        statusCode: 200,
        body: {
          json: async () => ({
            messages: [{ id: 'wamid.TEST' }],
          }),
        },
      } as any;
    };

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
    const calls: any[] = [];

    const requestFn = async (_url: any, init: any) => {
      calls.push({ init });

      return {
        statusCode: 200,
        body: {
          json: async () => ({
            messages: [{ id: 'wamid.TEMPLATE' }],
          }),
        },
      } as any;
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

    const body = JSON.parse(calls[0].init.body);
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('hello_world');
    expect(body.template.language.code).toBe('pt_BR');
  });

  it('should throw when response is not 2xx', async () => {
    const requestFn = async () => {
      return {
        statusCode: 500,
        body: {
          json: async () => ({ error: { message: 'fail' } }),
        },
      } as any;
    };

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
    ).rejects.toThrow('WhatsApp API error: 500');
  });
});
