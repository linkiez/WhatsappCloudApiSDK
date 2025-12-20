import { request as undiciRequest } from 'undici';

export type WhatsAppRequestInit = {
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type WhatsAppResponseBody = {
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export type WhatsAppResponse = {
  statusCode: number;
  body: WhatsAppResponseBody;
};

export type WhatsAppRequestFn = (
  url: string,
  init: WhatsAppRequestInit,
) => Promise<WhatsAppResponse>;

export const defaultRequestFn: WhatsAppRequestFn = async (url, init) => {
  return (await undiciRequest(url, init as never)) as unknown as WhatsAppResponse;
};

export async function readJsonSafely(
  body: { json: () => Promise<unknown> } | undefined,
): Promise<unknown> {
  if (!body) return undefined;

  try {
    return await body.json();
  } catch {
    return undefined;
  }
}
