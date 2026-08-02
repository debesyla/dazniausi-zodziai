const defaultSiteUrl = 'http://127.0.0.1:4173';

export const publicRoutes = [
  '',
  'apie',
  'duomenu-katalogas',
  'zodyno-apreptis',
  'karo-zodziu-palyginimas',
  'zanru-profilis',
  'sintakse'
] as const;

function normalizePublicSiteUrl(value?: string) {
  const url = new URL((value || defaultSiteUrl).trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PUBLIC_SITE_URL must use http or https');
  }
  if (url.search || url.hash) {
    throw new Error('PUBLIC_SITE_URL must not contain a query or fragment');
  }
  url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

export function createSite(publicSiteUrl?: string) {
  const url = normalizePublicSiteUrl(publicSiteUrl);
  return {
    name: 'Dažniausi lietuviški žodžiai',
    url,
    homeUrl: `${url}/`,
    methodologyUrl: `${url}/apie`,
    catalogueUrl: `${url}/duomenu-katalogas`,
    coverageProfileUrl: `${url}/zodyno-apreptis`,
    wartimeContrastUrl: `${url}/karo-zodziu-palyginimas`,
    genreProfileUrl: `${url}/zanru-profilis`,
    syntaxExplorerUrl: `${url}/sintakse`,
    socialImageUrl: `${url}/social-preview.png`,
    description: 'Naršykite viešus lietuvių kalbos lemų ir žodžių formų dažnumo sąrašus: ieškokite, filtruokite, analizuokite rodiklius ir atsisiųskite duomenis su jų šaltiniais.'
  } as const;
}

const configuredPublicSiteUrl = import.meta.env.PUBLIC_SITE_URL;

export const site = createSite(configuredPublicSiteUrl);
