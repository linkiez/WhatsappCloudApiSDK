import { WhatsAppValidationError } from './WhatsAppErrors';
import WhatsAppManagementClient from './WhatsAppManagementService';

describe('WhatsAppManagementClient', () => {
  it('should list message templates', async () => {
    const calls: any[] = [];

    const requestFn = async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return {
        statusCode: 200,
        body: {
          json: async () => ({
            data: [
              {
                id: 'tmpl_1',
                name: 'reservation_confirmation',
                category: 'UTILITY',
                status: 'APPROVED',
              },
            ],
          }),
        },
      } as any;
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

    expect(calls[0].url).toBe(
      'https://graph.facebook.com/v20.0/102290129340398/message_templates?fields=name%2Ccategory%2Cstatus&limit=5',
    );
    expect(calls[0].init.headers.Authorization).toBe('Bearer token');
  });

  it('should list phone numbers', async () => {
    const requestFn = async () => {
      return {
        statusCode: 200,
        body: {
          json: async () => ({
            data: [
              {
                id: 'phone_1',
                display_phone_number: '5511999999999',
                verified_name: 'My Business',
                status: 'CONNECTED',
              },
            ],
          }),
        },
      } as any;
    };

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
});
