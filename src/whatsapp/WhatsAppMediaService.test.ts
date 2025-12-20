import WhatsAppMediaClient from './WhatsAppMediaService';

describe('WhatsAppMediaClient', () => {
  it('should upload media and return mediaId', async () => {
    const calls: any[] = [];

    const requestFn = async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return {
        statusCode: 200,
        body: { json: async () => ({ id: 'media.1' }) },
      } as any;
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
    expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/123/media');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers.Authorization).toBe('Bearer token');
  });

  it('should get media url', async () => {
    const requestFn = async () => {
      return {
        statusCode: 200,
        body: { json: async () => ({ url: 'https://example.com/file' }) },
      } as any;
    };

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
    const requestFn = async () => {
      return {
        statusCode: 200,
        body: {
          json: async () => ({}),
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
        },
      } as any;
    };

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
    const calls: any[] = [];
    const requestFn = async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return {
        statusCode: 200,
        body: { json: async () => ({ success: true }) },
      } as any;
    };

    const client = new WhatsAppMediaClient({
      accessToken: 'token',
      phoneNumberId: '123',
      apiVersion: 'v20.0',
      requestFn,
    });

    await client.deleteMedia({ mediaId: 'media.1' });

    expect(calls[0].url).toBe('https://graph.facebook.com/v20.0/media.1');
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].init.headers.Authorization).toBe('Bearer token');
  });
});
