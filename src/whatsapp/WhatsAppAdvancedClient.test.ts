import WhatsAppAdvancedClient from './WhatsAppAdvancedService';

describe('WhatsAppAdvancedClient', () => {
  it('should call groups endpoint using configured base path', async () => {
    const calls: any[] = [];

    const requestFn = async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return {
        statusCode: 200,
        body: { json: async () => ({ ok: true }) },
      } as any;
    };

    const client = new WhatsAppAdvancedClient({
      apiVersion: 'v20.0',
      accessToken: 'token',
      advanced: {
        enabled: true,
        groupsBasePath: 'whatsapp_business_accounts/123',
        callingBasePath: 'whatsapp_business_accounts/123',
      },
      requestFn,
    });

    const result = await client.request({
      category: 'groups',
      path: 'groups',
      method: 'GET',
    });

    expect(result.raw).toEqual({ ok: true });
    expect(calls[0].url).toContain('/v20.0/whatsapp_business_accounts/123/groups');
    expect(calls[0].init.headers.Authorization).toBe('Bearer token');
  });

  it('should throw when advanced is disabled', async () => {
    const client = new WhatsAppAdvancedClient({
      apiVersion: 'v20.0',
      accessToken: 'token',
      advanced: {
        enabled: false,
      },
      requestFn: (async () => {
        throw new Error('should not call');
      }) as any,
    });

    await expect(
      client.request({
        category: 'groups',
        path: 'groups',
        method: 'GET',
      }),
    ).rejects.toThrow('WhatsApp advanced features (groups/calling) are not enabled');
  });
});
