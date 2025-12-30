import type { JsonObject, JsonValue } from './Json.js';
import { WhatsAppApiError, WhatsAppValidationError } from './WhatsAppErrors.js';
import {
  defaultRequestFn,
  readJsonSafely,
  type WhatsAppRequestFn,
} from './WhatsAppRequest.js';
import { buildGraphUrl, isNonEmptyString, joinPath } from './whatsAppUtils.js';

export type WhatsAppAdvancedConfig = {
  enabled?: boolean;
  groupsBasePath?: string;
  callingBasePath?: string;
};

export type WhatsAppAdvancedClientOptions = {
  accessToken: string;
  apiVersion?: string;
  baseUrl?: string;
  requestFn?: WhatsAppRequestFn;
  advanced?: WhatsAppAdvancedConfig;
};

export type WhatsAppAdvancedCategory = 'groups' | 'calling';

export type WhatsAppAdvancedRequestParams = {
  category: WhatsAppAdvancedCategory;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | undefined>;
  body?: JsonValue;
  basePathOverride?: string;
};

export type WhatsAppAdvancedRequestResult = {
  raw: JsonValue | undefined;
};

export type WhatsAppCallingConnectParams = {
  to: string;
  sdp: string;
};

export type WhatsAppCallingControlParams = {
  callId: string;
  sdp?: string;
};

export type WhatsAppCallingSettings = JsonObject;

export type WhatsAppCallingUpdateSettingsParams = {
  calling: WhatsAppCallingSettings;
};

export type WhatsAppCallingGetSettingsParams = {
  includeSipCredentials?: boolean;
};

export type WhatsAppGroupsCreateGroupParams = {
  subject: string;
  description?: string;
  joinApprovalMode?: string;
};

export type WhatsAppGroupsListActiveGroupsParams = {
  limit?: number;
};

export type WhatsAppGroupsGetGroupInfoParams = {
  groupId: string;
  fields?: string[];
};

export type WhatsAppGroupsGroupIdParams = {
  groupId: string;
};

export type WhatsAppGroupsJoinRequestsParams = WhatsAppGroupsGroupIdParams & {
  joinRequests: string[];
};

export type WhatsAppGroupsRemoveParticipantsParams =
  WhatsAppGroupsGroupIdParams & {
    participants: string[];
  };

export type WhatsAppGroupsPinMessageParams = WhatsAppGroupsGroupIdParams & {
  messageId: string;
  expirationDays?: number;
};

export type WhatsAppGroupsUnpinMessageParams = WhatsAppGroupsGroupIdParams & {
  messageId: string;
};

export default class WhatsAppAdvancedClient {
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly baseUrl: string;
  private readonly requestFn: WhatsAppRequestFn;
  private readonly advanced: WhatsAppAdvancedConfig;

  constructor(options: WhatsAppAdvancedClientOptions) {
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
    this.advanced = options.advanced ?? {};
  }

  private ensureAdvancedEnabled(): void {
    if (this.advanced.enabled !== true) {
      throw new WhatsAppValidationError(
        'WhatsApp advanced features (groups/calling) are not enabled',
      );
    }
  }

  private resolveBasePath(
    category: WhatsAppAdvancedCategory,
    basePathOverride?: string,
  ): string {
    this.ensureAdvancedEnabled();

    if (basePathOverride !== undefined) {
      return String(basePathOverride);
    }

    const basePath =
      category === 'groups'
        ? this.advanced.groupsBasePath
        : this.advanced.callingBasePath;

    if (!isNonEmptyString(basePath)) {
      throw new WhatsAppValidationError(
        'WhatsApp advanced endpoints are not configured',
      );
    }

    return basePath;
  }

  private async requestJson(
    url: string,
    init: { method: string; body?: JsonValue },
  ): Promise<JsonValue | undefined> {
    const response = await this.requestFn(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });

    const responseBody = await readJsonSafely(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new WhatsAppApiError('WhatsApp Graph API request failed', {
        statusCode: response.statusCode,
        responseBody,
        raw: responseBody,
      });
    }

    return responseBody;
  }

  async request(
    params: WhatsAppAdvancedRequestParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.path)) {
      throw new WhatsAppValidationError('WhatsApp advanced path is required');
    }

    const basePath = this.resolveBasePath(params.category, params.basePathOverride);
    const fullPath = joinPath(basePath, params.path);
    const url = buildGraphUrl(this.baseUrl, this.apiVersion, fullPath, params.query);

    const raw = await this.requestJson(url, {
      method: params.method,
      body: params.body,
    });

    return { raw };
  }

  async createGroup(
    params: WhatsAppGroupsCreateGroupParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.subject)) {
      throw new WhatsAppValidationError('WhatsApp group subject is required');
    }

    return this.request({
      category: 'groups',
      path: 'groups',
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
        subject: params.subject,
        ...(isNonEmptyString(params.description)
          ? { description: params.description }
          : {}),
        ...(isNonEmptyString(params.joinApprovalMode)
          ? { join_approval_mode: params.joinApprovalMode }
          : {}),
      },
    });
  }

  async listActiveGroups(
    params: WhatsAppGroupsListActiveGroupsParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    const limitNumber =
      typeof params?.limit === 'number' && Number.isFinite(params.limit)
        ? params.limit
        : undefined;

    return this.request({
      category: 'groups',
      path: 'groups',
      method: 'GET',
      query:
        typeof limitNumber === 'number'
          ? { limit: String(limitNumber) }
          : undefined,
    });
  }

  async getGroupInfo(
    params: WhatsAppGroupsGetGroupInfoParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    const fields = Array.isArray(params.fields)
      ? params.fields.filter(isNonEmptyString)
      : [];

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: params.groupId,
      method: 'GET',
      query: fields.length > 0 ? { fields: fields.join(',') } : undefined,
    });
  }

  async getGroupInviteLink(
    params: WhatsAppGroupsGroupIdParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: joinPath(params.groupId, 'invite_link'),
      method: 'GET',
    });
  }

  async resetGroupInviteLink(
    params: WhatsAppGroupsGroupIdParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: joinPath(params.groupId, 'invite_link'),
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
      },
    });
  }

  async listJoinRequests(
    params: WhatsAppGroupsGroupIdParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: joinPath(params.groupId, 'join_requests'),
      method: 'GET',
    });
  }

  async approveJoinRequests(
    params: WhatsAppGroupsJoinRequestsParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    if (!Array.isArray(params.joinRequests) || params.joinRequests.length === 0) {
      throw new WhatsAppValidationError('WhatsApp joinRequests are required');
    }

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: joinPath(params.groupId, 'join_requests'),
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
        join_requests: params.joinRequests,
      },
    });
  }

  async rejectJoinRequests(
    params: WhatsAppGroupsJoinRequestsParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    if (!Array.isArray(params.joinRequests) || params.joinRequests.length === 0) {
      throw new WhatsAppValidationError('WhatsApp joinRequests are required');
    }

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: joinPath(params.groupId, 'join_requests'),
      method: 'DELETE',
      body: {
        messaging_product: 'whatsapp',
        join_requests: params.joinRequests,
      },
    });
  }

  async removeGroupParticipants(
    params: WhatsAppGroupsRemoveParticipantsParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    if (!Array.isArray(params.participants) || params.participants.length === 0) {
      throw new WhatsAppValidationError('WhatsApp participants are required');
    }

    const participants = params.participants
      .filter(isNonEmptyString)
      .map((user) => ({ user }));

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: joinPath(params.groupId, 'participants'),
      method: 'DELETE',
      body: {
        messaging_product: 'whatsapp',
        participants,
      },
    });
  }

  async deleteGroup(
    params: WhatsAppGroupsGroupIdParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    return this.request({
      category: 'groups',
      basePathOverride: '',
      path: params.groupId,
      method: 'DELETE',
    });
  }

  private async pinOrUnpinGroupMessage(
    params: WhatsAppGroupsPinMessageParams | WhatsAppGroupsUnpinMessageParams,
    operation: 'pin' | 'unpin',
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.groupId)) {
      throw new WhatsAppValidationError('WhatsApp groupId is required');
    }

    if (!isNonEmptyString(params?.messageId)) {
      throw new WhatsAppValidationError('WhatsApp messageId is required');
    }

    const pin: {
      type: 'pin' | 'unpin';
      message_id: string;
      expirationDays?: number;
    } = {
      type: operation,
      message_id: params.messageId,
    };

    if (operation === 'pin') {
      const casted = params as WhatsAppGroupsPinMessageParams;
      if (typeof casted.expirationDays === 'number') {
        pin.expirationDays = casted.expirationDays;
      }
    }

    return this.request({
      category: 'groups',
      path: 'messages',
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'group',
        to: params.groupId,
        type: 'pin',
        pin,
      },
    });
  }

  async pinGroupMessage(
    params: WhatsAppGroupsPinMessageParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.pinOrUnpinGroupMessage(params, 'pin');
  }

  async unpinGroupMessage(
    params: WhatsAppGroupsUnpinMessageParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.pinOrUnpinGroupMessage(params, 'unpin');
  }

  async startBusinessInitiatedCall(
    params: WhatsAppCallingConnectParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.to)) {
      throw new WhatsAppValidationError('WhatsApp call to is required');
    }

    if (!isNonEmptyString(params?.sdp)) {
      throw new WhatsAppValidationError('WhatsApp call sdp is required');
    }

    return this.request({
      category: 'calling',
      path: 'calls',
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
        action: 'connect',
        to: params.to,
        sdp: params.sdp,
      },
    });
  }

  private async callControl(
    params: WhatsAppCallingControlParams,
    action: 'pre_accept' | 'accept' | 'reject' | 'terminate',
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (!isNonEmptyString(params?.callId)) {
      throw new WhatsAppValidationError('WhatsApp callId is required');
    }

    if ((action === 'pre_accept' || action === 'accept') && !isNonEmptyString(params?.sdp)) {
      throw new WhatsAppValidationError('WhatsApp call sdp is required');
    }

    const body: {
      messaging_product: 'whatsapp';
      action: 'pre_accept' | 'accept' | 'reject' | 'terminate';
      call_id: string;
      sdp?: string;
    } = {
      messaging_product: 'whatsapp',
      action,
      call_id: params.callId,
    };

    if (isNonEmptyString(params?.sdp)) body.sdp = params.sdp;

    return this.request({
      category: 'calling',
      path: 'calls',
      method: 'POST',
      body,
    });
  }

  async preAcceptCall(
    params: WhatsAppCallingControlParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.callControl(params, 'pre_accept');
  }

  async acceptCall(
    params: WhatsAppCallingControlParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.callControl(params, 'accept');
  }

  async rejectCall(
    params: WhatsAppCallingControlParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.callControl(params, 'reject');
  }

  async terminateCall(
    params: WhatsAppCallingControlParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.callControl(params, 'terminate');
  }

  async getCallingSettings(
    params: WhatsAppCallingGetSettingsParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    return this.request({
      category: 'calling',
      path: 'settings',
      method: 'GET',
      query:
        typeof params?.includeSipCredentials === 'boolean'
          ? { include_sip_credentials: String(params.includeSipCredentials) }
          : undefined,
    });
  }

  async updateCallingSettings(
    params: WhatsAppCallingUpdateSettingsParams,
  ): Promise<WhatsAppAdvancedRequestResult> {
    if (typeof params?.calling !== 'object' || params.calling === null) {
      throw new WhatsAppValidationError('WhatsApp calling settings are required');
    }

    return this.request({
      category: 'calling',
      path: 'settings',
      method: 'POST',
      body: {
        messaging_product: 'whatsapp',
        calling: params.calling,
      },
    });
  }
}
