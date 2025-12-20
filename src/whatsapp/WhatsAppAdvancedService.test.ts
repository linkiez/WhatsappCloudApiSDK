import WhatsAppAdvancedClient from './WhatsAppAdvancedService';
import { WhatsAppValidationError } from './WhatsAppErrors';

describe('WhatsAppAdvancedClient', () => {
  it('should throw when advanced is disabled', async () => {
    const client = new WhatsAppAdvancedClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      advanced: { enabled: false, groupsBasePath: 'phone_123' },
      requestFn: (async () => {
        throw new Error('should not call');
      }) as any,
    });

    await expect(
      client.request({ category: 'groups', path: 'groups', method: 'GET' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('should throw when enabled but groupsBasePath is missing', async () => {
    const client = new WhatsAppAdvancedClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      advanced: { enabled: true },
      requestFn: (async () => {
        throw new Error('should not call');
      }) as any,
    });

    await expect(
      client.request({ category: 'groups', path: 'groups', method: 'GET' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('should call Graph API when enabled and configured', async () => {
    const calls: any[] = [];
    const requestFn = async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return { statusCode: 200, body: { json: async () => ({ data: [{ id: 'g1' }] }) } } as any;
    };

    const client = new WhatsAppAdvancedClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      advanced: { enabled: true, groupsBasePath: 'phone_123' },
      requestFn,
    });

    const result = await client.request({
      category: 'groups',
      path: 'groups',
      method: 'GET',
      query: { limit: '10' },
    });

    expect(result.raw).toEqual({ data: [{ id: 'g1' }] });
    expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/groups?limit=10');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.headers.Authorization).toBe('Bearer token');
  });

  describe('groups wrappers', () => {
    const makeClient = (requestFn: any) =>
      new WhatsAppAdvancedClient({
        accessToken: 'token',
        apiVersion: 'v20.0',
        advanced: { enabled: true, groupsBasePath: 'phone_123' },
        requestFn,
      });

    it('should create group via POST /{BUSINESS_PHONE_NUMBER_ID}/groups', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ messaging_product: 'whatsapp' }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.createGroup({
        subject: 'New Purchase Inquiry',
        description: 'Desc',
        joinApprovalMode: 'auto_approve',
      });

      expect(result.raw).toEqual({ messaging_product: 'whatsapp' });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/groups');
      expect(JSON.parse(calls[0].init.body)).toEqual({
        messaging_product: 'whatsapp',
        subject: 'New Purchase Inquiry',
        description: 'Desc',
        join_approval_mode: 'auto_approve',
      });
    });

    it('should list active groups via GET /{BUSINESS_PHONE_NUMBER_ID}/groups', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ data: { groups: [{ id: 'g1' }] } }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.listActiveGroups({ limit: 10 });

      expect(result.raw).toEqual({ data: { groups: [{ id: 'g1' }] } });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/groups?limit=10');
      expect(calls[0].init.method).toBe('GET');
    });

    it('should get group info via GET /{GROUP_ID}?fields=...', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ id: 'group_1', subject: 'S' }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.getGroupInfo({
        groupId: 'group_1',
        fields: ['subject', 'description'],
      });

      expect(result.raw).toEqual({ id: 'group_1', subject: 'S' });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1?fields=subject%2Cdescription');
    });

    it('should get invite link via GET /{GROUP_ID}/invite_link', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ invite_link: 'https://chat.whatsapp.com/x' }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.getGroupInviteLink({ groupId: 'group_1' });

      expect(result.raw).toEqual({ invite_link: 'https://chat.whatsapp.com/x' });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1/invite_link');
    });

    it('should reset invite link via POST /{GROUP_ID}/invite_link', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ success: true }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.resetGroupInviteLink({ groupId: 'group_1' });

      expect(result.raw).toEqual({ success: true });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1/invite_link');
      expect(JSON.parse(calls[0].init.body)).toEqual({ messaging_product: 'whatsapp' });
    });

    it('should list join requests via GET /{GROUP_ID}/join_requests', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ data: [] }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.listJoinRequests({ groupId: 'group_1' });

      expect(result.raw).toEqual({ data: [] });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1/join_requests');
    });

    it('should approve join requests via POST /{GROUP_ID}/join_requests', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ approved_join_requests: ['jr1'] }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.approveJoinRequests({
        groupId: 'group_1',
        joinRequests: ['jr1'],
      });

      expect(result.raw).toEqual({ approved_join_requests: ['jr1'] });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1/join_requests');
      expect(calls[0].init.method).toBe('POST');
      expect(JSON.parse(calls[0].init.body)).toEqual({
        messaging_product: 'whatsapp',
        join_requests: ['jr1'],
      });
    });

    it('should reject join requests via DELETE /{GROUP_ID}/join_requests', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ rejected_join_requests: ['jr1'] }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.rejectJoinRequests({
        groupId: 'group_1',
        joinRequests: ['jr1'],
      });

      expect(result.raw).toEqual({ rejected_join_requests: ['jr1'] });
      expect(calls[0].init.method).toBe('DELETE');
      expect(JSON.parse(calls[0].init.body)).toEqual({
        messaging_product: 'whatsapp',
        join_requests: ['jr1'],
      });
    });

    it('should remove participants via DELETE /{GROUP_ID}/participants', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ success: true }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.removeGroupParticipants({
        groupId: 'group_1',
        participants: ['+17865347866', '16505551234'],
      });

      expect(result.raw).toEqual({ success: true });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1/participants');
      expect(JSON.parse(calls[0].init.body)).toEqual({
        messaging_product: 'whatsapp',
        participants: [{ user: '+17865347866' }, { user: '16505551234' }],
      });
    });

    it('should delete group via DELETE /{GROUP_ID}', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ success: true }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.deleteGroup({ groupId: 'group_1' });

      expect(result.raw).toEqual({ success: true });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/group_1');
      expect(calls[0].init.method).toBe('DELETE');
    });

    it.each([
      ['pin', { expirationDays: 4 }],
      ['unpin', {}],
    ] as const)(
      'should %s group message via POST /{BUSINESS_PHONE_NUMBER_ID}/messages',
      async (operation, extra) => {
        const calls: any[] = [];
        const requestFn = async (url: any, init: any) => {
          calls.push({ url: String(url), init });
          return { statusCode: 200, body: { json: async () => ({ messages: [{ id: 'wamid.1' }] }) } } as any;
        };

        const client = makeClient(requestFn);
        const messageId = 'wamid.1';

        const result =
          operation === 'pin'
            ? await client.pinGroupMessage({
                groupId: 'group_1',
                messageId,
                expirationDays: 4,
              })
            : await client.unpinGroupMessage({
                groupId: 'group_1',
                messageId,
              });

        expect(result.raw).toEqual({ messages: [{ id: 'wamid.1' }] });

        const expectedPin: Record<string, unknown> = {
          type: operation,
          message_id: messageId,
          ...extra,
        };

        expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/messages');
        expect(JSON.parse(calls[0].init.body)).toEqual({
          messaging_product: 'whatsapp',
          recipient_type: 'group',
          to: 'group_1',
          type: 'pin',
          pin: expectedPin,
        });
      },
    );
  });

  describe('calling wrappers', () => {
    const makeClient = (requestFn: any) =>
      new WhatsAppAdvancedClient({
        accessToken: 'token',
        apiVersion: 'v20.0',
        advanced: { enabled: true, callingBasePath: 'phone_123' },
        requestFn,
      });

    it('should start call (connect) via POST /{PHONE_NUMBER_ID}/calls', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ calls: [{ id: 'call_1' }] }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.startBusinessInitiatedCall({
        to: '5511999999999',
        sdp: 'v=0',
      });

      expect(result.raw).toEqual({ calls: [{ id: 'call_1' }] });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/calls');
      expect(JSON.parse(calls[0].init.body)).toEqual({
        messaging_product: 'whatsapp',
        action: 'connect',
        to: '5511999999999',
        sdp: 'v=0',
      });
    });

    it.each([
      ['preAcceptCall', 'pre_accept', { callId: 'call_1', sdp: 'v=0' }],
      ['acceptCall', 'accept', { callId: 'call_1', sdp: 'v=0' }],
      ['rejectCall', 'reject', { callId: 'call_1' }],
      ['terminateCall', 'terminate', { callId: 'call_1' }],
    ] as const)(
      'should control call via %s with action=%s',
      async (methodName, action, args) => {
        const calls: any[] = [];
        const requestFn = async (url: any, init: any) => {
          calls.push({ url: String(url), init });
          return { statusCode: 200, body: { json: async () => ({ success: true }) } } as any;
        };

        const client = makeClient(requestFn);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (client as any)[methodName](args);

        expect(result.raw).toEqual({ success: true });

        const expectedBody: Record<string, unknown> = {
          messaging_product: 'whatsapp',
          action,
          call_id: 'call_1',
        };

        if ('sdp' in args) expectedBody.sdp = (args as any).sdp;

        expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/calls');
        expect(JSON.parse(calls[0].init.body)).toEqual(expectedBody);
      },
    );

    it('should get settings via GET /{PHONE_NUMBER_ID}/settings', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ calling: { status: 'enabled' } }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.getCallingSettings({ includeSipCredentials: true });

      expect(result.raw).toEqual({ calling: { status: 'enabled' } });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/settings?include_sip_credentials=true');
    });

    it('should update settings via POST /{PHONE_NUMBER_ID}/settings', async () => {
      const calls: any[] = [];
      const requestFn = async (url: any, init: any) => {
        calls.push({ url: String(url), init });
        return { statusCode: 200, body: { json: async () => ({ success: true }) } } as any;
      };

      const client = makeClient(requestFn);
      const result = await client.updateCallingSettings({
        calling: { status: 'enabled' },
      });

      expect(result.raw).toEqual({ success: true });
      expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/phone_123/settings');
      expect(JSON.parse(calls[0].init.body)).toEqual({
        messaging_product: 'whatsapp',
        calling: { status: 'enabled' },
      });
    });
  });
});
