export function normalizeBasePath(value = '') {
  const basePath = value.trim();
  if (basePath === '' || basePath === '/') return '';
  if (!basePath.startsWith('/') || basePath.endsWith('/')) {
    throw new Error('BASE_PATH must be empty or start with one slash and have no trailing slash');
  }
  if (basePath.includes('?') || basePath.includes('#') || basePath.includes('//')) {
    throw new Error('BASE_PATH must be a plain URL path without a query, fragment, or repeated slash');
  }
  return basePath;
}

export function normalizeSiteUrl(value, basePath = '') {
  const fallback = `http://127.0.0.1:4173${basePath}`;
  const url = new URL((value || fallback).trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PUBLIC_SITE_URL must use http or https');
  }
  if (url.search || url.hash) {
    throw new Error('PUBLIC_SITE_URL must not contain a query or fragment');
  }

  const normalizedPath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  if (basePath && normalizedPath !== basePath) {
    throw new Error(`PUBLIC_SITE_URL must end with the configured BASE_PATH (${basePath})`);
  }
  url.pathname = normalizedPath;
  return url.toString().replace(/\/$/, '');
}
