import { describe, expect, it } from 'vitest';
import { normalizeBasePath, normalizeSiteUrl } from '../../scripts/site-config.mjs';
import { createSite, publicRoutes } from '../../src/lib/site';

describe('portable site configuration', () => {
  it('uses a root-local preview URL when no host is configured', () => {
    expect(normalizeBasePath()).toBe('');
    expect(normalizeSiteUrl(undefined)).toBe('http://127.0.0.1:4173');
  });

  it('keeps an explicit base path aligned with the public URL', () => {
    const basePath = normalizeBasePath('/lietuviu-zodziai');
    expect(normalizeSiteUrl('https://example.test/lietuviu-zodziai/', basePath))
      .toBe('https://example.test/lietuviu-zodziai');
  });

  it('rejects ambiguous or mismatched hosting configuration', () => {
    expect(() => normalizeBasePath('lietuviu-zodziai')).toThrow(/start with one slash/);
    expect(() => normalizeBasePath('/lietuviu-zodziai/')).toThrow(/no trailing slash/);
    expect(() => normalizeSiteUrl('https://example.test/other', '/lietuviu-zodziai'))
      .toThrow(/must end with the configured BASE_PATH/);
    expect(() => normalizeSiteUrl('file:///tmp/site')).toThrow(/http or https/);
  });

  it('builds every public metadata URL from one configured base URL', () => {
    const configured = createSite('https://zodziai.example.test/app/');
    expect(configured.homeUrl).toBe('https://zodziai.example.test/app/');
    expect(configured.methodologyUrl).toBe('https://zodziai.example.test/app/apie');
    expect(configured.catalogueUrl).toBe('https://zodziai.example.test/app/duomenu-katalogas');
    expect(configured.socialImageUrl).toBe('https://zodziai.example.test/app/social-preview.png');
    expect(publicRoutes).toContain('zanru-profilis');
    expect(publicRoutes).toContain('sintakse');
  });
});
