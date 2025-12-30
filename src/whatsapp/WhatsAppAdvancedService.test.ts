import type { JsonValue } from './Json';
import WhatsAppAdvancedClient from './WhatsAppAdvancedService';
import { WhatsAppValidationError } from './WhatsAppErrors';
import type {
    WhatsAppRequestFn,
    WhatsAppRequestInit,
    WhatsAppResponse,
} from './WhatsAppRequest';

type RequestCall = { url: string; init: WhatsAppRequestInit };

function makeMockRequestFn(
  calls: RequestCall[],
  statusCode: number,
  json: JsonValue,
): WhatsAppRequestFn {
  return async (url, init) => {
    calls.push({ url: String(url), init });

    const response: WhatsAppResponse = {
      statusCode,
      body: {
        json: async () => json,
        text: async () => JSON.stringify(json),
        arrayBuffer: async () => new ArrayBuffer(0),
      },
    };

    return response;
  };
}

describe('WhatsAppAdvancedClient', () => {
  it('should throw when advanced is disabled', async () => {
    const client = new WhatsAppAdvancedClient({
      accessToken: 'token',
      apiVersion: 'v20.0',
      advanced: { enabled: false, groupsBasePath: 'phone_123' },
      requestFn: async () => {
        throw new Error('should not call');
      },
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
      requestFn: async () => {
        throw new Error('should not call');
      },
    });

    await expect(
      client.request({ category: 'groups', path: 'groups', method: 'GET' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('should call Graph API when enabled and configured', async () => {
    const calls: RequestCall[] = [];
    const requestFn = makeMockRequestFn(calls, 200, { data: [{ id: 'g1' }] });

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
    expect(calls).toHaveLength(1);
    const firstCall = calls[0];
    if (!firstCall) throw new Error('Expected requestFn to be called');

    expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/groups?limit=10');
    expect(firstCall.init.method).toBe('GET');
    expect(firstCall.init.headers?.Authorization).toBe('Bearer token');
  });

  describe('groups wrappers', () => {
    const makeClient = (requestFn: WhatsAppRequestFn) =>
      new WhatsAppAdvancedClient({
        accessToken: 'token',
        apiVersion: 'v20.0',
        advanced: { enabled: true, groupsBasePath: 'phone_123' },
        requestFn,
      });

    it('should create group via POST /{BUSINESS_PHONE_NUMBER_ID}/groups', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        messaging_product: 'whatsapp',
      });

      const client = makeClient(requestFn);
      const result = await client.createGroup({
        subject: 'New Purchase Inquiry',
        description: 'Desc',
        joinApprovalMode: 'auto_approve',
      });

      expect(result.raw).toEqual({ messaging_product: 'whatsapp' });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/groups');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
        messaging_product: 'whatsapp',
        subject: 'New Purchase Inquiry',
        description: 'Desc',
        join_approval_mode: 'auto_approve',
      });
    });

    it('should list active groups via GET /{BUSINESS_PHONE_NUMBER_ID}/groups', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        data: { groups: [{ id: 'g1' }] },
      });

      const client = makeClient(requestFn);
      const result = await client.listActiveGroups({ limit: 10 });

      expect(result.raw).toEqual({ data: { groups: [{ id: 'g1' }] } });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/groups?limit=10');
      expect(firstCall.init.method).toBe('GET');
    });

    it('should get group info via GET /{GROUP_ID}?fields=...', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        id: 'group_1',
        subject: 'S',
      });

      const client = makeClient(requestFn);
      const result = await client.getGroupInfo({
        groupId: 'group_1',
        fields: ['subject', 'description'],
      });

      expect(result.raw).toEqual({ id: 'group_1', subject: 'S' });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1?fields=subject%2Cdescription');
    });

    it('should get invite link via GET /{GROUP_ID}/invite_link', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        invite_link: 'https://chat.whatsapp.com/x',
      });

      const client = makeClient(requestFn);
      const result = await client.getGroupInviteLink({ groupId: 'group_1' });

      expect(result.raw).toEqual({ invite_link: 'https://chat.whatsapp.com/x' });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1/invite_link');
    });

    it('should reset invite link via POST /{GROUP_ID}/invite_link', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, { success: true });

      const client = makeClient(requestFn);
      const result = await client.resetGroupInviteLink({ groupId: 'group_1' });

      expect(result.raw).toEqual({ success: true });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1/invite_link');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
        messaging_product: 'whatsapp',
      });
    });

    it('should list join requests via GET /{GROUP_ID}/join_requests', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, { data: [] });

      const client = makeClient(requestFn);
      const result = await client.listJoinRequests({ groupId: 'group_1' });

      expect(result.raw).toEqual({ data: [] });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1/join_requests');
    });

    it('should approve join requests via POST /{GROUP_ID}/join_requests', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        approved_join_requests: ['jr1'],
      });

      const client = makeClient(requestFn);
      const result = await client.approveJoinRequests({
        groupId: 'group_1',
        joinRequests: ['jr1'],
      });

      expect(result.raw).toEqual({ approved_join_requests: ['jr1'] });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1/join_requests');
      expect(firstCall.init.method).toBe('POST');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
        messaging_product: 'whatsapp',
        join_requests: ['jr1'],
      });
    });

    it('should reject join requests via DELETE /{GROUP_ID}/join_requests', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        rejected_join_requests: ['jr1'],
      });

      const client = makeClient(requestFn);
      const result = await client.rejectJoinRequests({
        groupId: 'group_1',
        joinRequests: ['jr1'],
      });

      expect(result.raw).toEqual({ rejected_join_requests: ['jr1'] });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.init.method).toBe('DELETE');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
        messaging_product: 'whatsapp',
        join_requests: ['jr1'],
      });
    });

    it('should remove participants via DELETE /{GROUP_ID}/participants', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, { success: true });

      const client = makeClient(requestFn);
      const result = await client.removeGroupParticipants({
        groupId: 'group_1',
        participants: ['+17865347866', '16505551234'],
      });

      expect(result.raw).toEqual({ success: true });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1/participants');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
        messaging_product: 'whatsapp',
        participants: [{ user: '+17865347866' }, { user: '16505551234' }],
      });
    });

    it('should delete group via DELETE /{GROUP_ID}', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, { success: true });

      const client = makeClient(requestFn);
      const result = await client.deleteGroup({ groupId: 'group_1' });

      expect(result.raw).toEqual({ success: true });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/group_1');
      expect(firstCall.init.method).toBe('DELETE');
    });

    it.each([
      ['pin', { expirationDays: 4 }],
      ['unpin', {}],
    ] as const)(
      'should %s group message via POST /{BUSINESS_PHONE_NUMBER_ID}/messages',
      async (operation, extra) => {
        const calls: RequestCall[] = [];
        const requestFn = makeMockRequestFn(calls, 200, {
          messages: [{ id: 'wamid.1' }],
        });

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

        const expectedPin = { type: operation, message_id: messageId, ...extra };

        expect(calls).toHaveLength(1);
        const firstCall = calls[0];
        if (!firstCall) throw new Error('Expected requestFn to be called');

        expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/messages');
        if (typeof firstCall.init.body !== 'string') {
          throw new TypeError('Expected JSON request body');
        }

        expect(JSON.parse(firstCall.init.body)).toEqual({
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
    const makeClient = (requestFn: WhatsAppRequestFn) =>
      new WhatsAppAdvancedClient({
        accessToken: 'token',
        apiVersion: 'v20.0',
        advanced: { enabled: true, callingBasePath: 'phone_123' },
        requestFn,
      });

    it('should start call (connect) via POST /{PHONE_NUMBER_ID}/calls', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, { calls: [{ id: 'call_1' }] });

      const client = makeClient(requestFn);
      const result = await client.startBusinessInitiatedCall({
        to: '5511999999999',
        sdp: 'v=0',
      });

      expect(result.raw).toEqual({ calls: [{ id: 'call_1' }] });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/calls');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
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
        const calls: RequestCall[] = [];
        const requestFn = makeMockRequestFn(calls, 200, { success: true });

        const client = makeClient(requestFn);

        const callControlMethods = {
          preAcceptCall: client.preAcceptCall.bind(client),
          acceptCall: client.acceptCall.bind(client),
          rejectCall: client.rejectCall.bind(client),
          terminateCall: client.terminateCall.bind(client),
        } as const;

        const result = await callControlMethods[methodName](args);

        expect(result.raw).toEqual({ success: true });

        const expectedBody: Record<string, JsonValue> = {
          messaging_product: 'whatsapp',
          action,
          call_id: 'call_1',
        };

        if ('sdp' in args) expectedBody.sdp = args.sdp;

        expect(calls).toHaveLength(1);
        const firstCall = calls[0];
        if (!firstCall) throw new Error('Expected requestFn to be called');

        expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/calls');
        if (typeof firstCall.init.body !== 'string') {
          throw new TypeError('Expected JSON request body');
        }

        expect(JSON.parse(firstCall.init.body)).toEqual(expectedBody);
      },
    );

    it('should get settings via GET /{PHONE_NUMBER_ID}/settings', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, {
        calling: { status: 'enabled' },
      });

      const client = makeClient(requestFn);
      const result = await client.getCallingSettings({ includeSipCredentials: true });

      expect(result.raw).toEqual({ calling: { status: 'enabled' } });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe(
        'https://graph.facebook.com/v20.0/phone_123/settings?include_sip_credentials=true',
      );
    });

    it('should update settings via POST /{PHONE_NUMBER_ID}/settings', async () => {
      const calls: RequestCall[] = [];
      const requestFn = makeMockRequestFn(calls, 200, { success: true });

      const client = makeClient(requestFn);
      const result = await client.updateCallingSettings({
        calling: { status: 'enabled' },
      });

      expect(result.raw).toEqual({ success: true });
      expect(calls).toHaveLength(1);
      const firstCall = calls[0];
      if (!firstCall) throw new Error('Expected requestFn to be called');

      expect(firstCall.url).toBe('https://graph.facebook.com/v20.0/phone_123/settings');
      if (typeof firstCall.init.body !== 'string') {
        throw new TypeError('Expected JSON request body');
      }

      expect(JSON.parse(firstCall.init.body)).toEqual({
        messaging_product: 'whatsapp',
        calling: { status: 'enabled' },
      });
    });
  });
});
