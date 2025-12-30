import type { FormData as UndiciFormData } from 'undici';
import { request as undiciRequest } from 'undici';

import type { JsonValue } from './Json.js';

export type WhatsAppRequestBody =
  | string
  | Uint8Array
  | ArrayBuffer
  | UndiciFormData
  | null;


export type WhatsAppRequestInit = {
  method: string;
  headers?: Record<string, string>;
  body?: WhatsAppRequestBody;
};

export type WhatsAppResponseBody = {
  json: () => Promise<JsonValue>;
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
  return (await undiciRequest(url, init as never)) as WhatsAppResponse;
};

export async function readJsonSafely(
  body: { json: () => Promise<JsonValue> } | undefined,
): Promise<JsonValue | undefined> {
  if (!body) return undefined;

  try {
    return await body.json();
  } catch {
    return undefined;
  }
}
