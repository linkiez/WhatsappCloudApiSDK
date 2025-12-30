import WhatsAppMediaClient from './WhatsAppMediaService';

import type { JsonValue } from './Json';
import type {
    WhatsAppRequestFn,
    WhatsAppRequestInit,
    WhatsAppResponse,
} from './WhatsAppRequest';

function createMockResponse(
  statusCode: number,
  json: JsonValue,
  arrayBufferOverride?: ArrayBuffer,
): WhatsAppResponse {
  const jsonText = JSON.stringify(json);
  return {
    statusCode,
    body: {
      json: async () => json,
      text: async () => jsonText,
      arrayBuffer: async () =>
        arrayBufferOverride ?? new TextEncoder().encode(jsonText).buffer,
    },
  };
}

describe('WhatsAppMediaClient', () => {
  it('should upload media and return mediaId', async () => {
    const calls: Array<{ url: string; init: WhatsAppRequestInit }> = [];

    const requestFn: WhatsAppRequestFn = async (url, init) => {
      calls.push({ url: String(url), init });
      return createMockResponse(200, { id: 'media.1' });
    };

    const client = new WhatsAppMediaClient({
      accessToken: 'token',
      phoneNumberId: '123',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.uploadMedia({
      fileName: 'file.pdf',
      contentType: 'application/pdf',
      content: new Uint8Array([1, 2, 3]),
    });

    expect(result.mediaId).toBe('media.1');
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v20.0/123/media');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers?.Authorization).toBe('Bearer token');
  });

  it('should get media url', async () => {
    const requestFn: WhatsAppRequestFn = async () =>
      createMockResponse(200, { url: 'https://example.com/file' });

    const client = new WhatsAppMediaClient({
      accessToken: 'token',
      phoneNumberId: '123',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.getMediaUrl({ mediaId: 'media.1' });
    expect(result.url).toBe('https://example.com/file');
  });

  it('should download media bytes', async () => {
    const requestFn: WhatsAppRequestFn = async () =>
      createMockResponse(200, {}, new Uint8Array([1, 2, 3]).buffer);

    const client = new WhatsAppMediaClient({
      accessToken: 'token',
      phoneNumberId: '123',
      apiVersion: 'v20.0',
      requestFn,
    });

    const result = await client.downloadMedia({
      mediaUrl: 'https://example.com/file',
    });

    expect(result.content).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('should delete media', async () => {
    const calls: Array<{ url: string; init: WhatsAppRequestInit }> = [];
    const requestFn: WhatsAppRequestFn = async (url, init) => {
      calls.push({ url: String(url), init });
      return createMockResponse(200, { success: true });
    };

    const client = new WhatsAppMediaClient({
      accessToken: 'token',
      phoneNumberId: '123',
      apiVersion: 'v20.0',
      requestFn,
    });

    await client.deleteMedia({ mediaId: 'media.1' });

    expect(calls[0]?.url).toBe('https://graph.facebook.com/v20.0/media.1');
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.init.headers?.Authorization).toBe('Bearer token');
  });
});
