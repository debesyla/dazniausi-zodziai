/** @param {string} value */
export function normalizePlaywrightBaseURL(value) {
  const url = new URL(value);
  if (url.search || url.hash) {
    throw new Error('PLAYWRIGHT_BASE_URL must not contain a query string or fragment');
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  return url.toString();
}
