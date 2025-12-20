export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/g, '');
}

export function normalizePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/g, '');
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
