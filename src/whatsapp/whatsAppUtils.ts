import type { JsonValue } from './Json.js';

export function isNonEmptyString(value: JsonValue | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeBaseUrl(baseUrl: string): string {
  let value = baseUrl;
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

export function normalizePath(path: string): string {
  let value = path;
  while (value.startsWith('/')) value = value.slice(1);
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

export function joinPath(left: string, right: string): string {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);

  if (!normalizedLeft) return normalizedRight;
  if (!normalizedRight) return normalizedLeft;
  return `${normalizedLeft}/${normalizedRight}`;
}

export function buildGraphUrl(
  baseUrl: string,
  apiVersion: string,
  path: string,
  query?: Record<string, string | undefined>,
): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.replace(/^\/+/, '');

  const url = `${normalizedBaseUrl}/${apiVersion}/${normalizedPath}`;

  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (isNonEmptyString(value)) params.set(key, value);
  }

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
