import { describe, expect, it } from 'vitest';
import { normalizePlaywrightBaseURL } from '../../scripts/playwright-base-url.mjs';

describe('Playwright hosted base URL', () => {
  it('keeps relative navigation inside a subpath without a trailing slash', () => {
    expect(normalizePlaywrightBaseURL('https://example.test/lietuviu-zodziai'))
      .toBe('https://example.test/lietuviu-zodziai/');
    expect(normalizePlaywrightBaseURL('https://example.test/lietuviu-zodziai/'))
      .toBe('https://example.test/lietuviu-zodziai/');
  });

  it('rejects ambiguous query and fragment bases', () => {
    expect(() => normalizePlaywrightBaseURL('https://example.test/app?view=1')).toThrow(/query string or fragment/);
    expect(() => normalizePlaywrightBaseURL('https://example.test/app#top')).toThrow(/query string or fragment/);
  });
});
