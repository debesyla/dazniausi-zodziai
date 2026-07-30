import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { normalizeBasePath, normalizeSiteUrl } from './site-config.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repositoryRoot, 'build');
const fileEnvironment = loadEnv(process.env.NODE_ENV ?? 'production', repositoryRoot, '');
const basePath = normalizeBasePath(process.env.BASE_PATH ?? fileEnvironment.BASE_PATH);
const siteUrl = normalizeSiteUrl(process.env.PUBLIC_SITE_URL ?? fileEnvironment.PUBLIC_SITE_URL, basePath);
const publicRoutes = [
  '',
  'apie',
  'duomenu-katalogas',
  'zodyno-apreptis',
  'karo-zodziu-palyginimas',
  'zanru-profilis',
  'sintakse'
];

async function readBuildFile(filename) {
  return readFile(path.join(outputRoot, filename), 'utf8');
}

function expectIncludes(content, expected, filename) {
  if (!content.includes(expected)) {
    throw new Error(`Expected ${filename} to include ${expected}`);
  }
}

const [home, methodology, robots, sitemap, socialImage] = await Promise.all([
  readBuildFile('index.html'),
  readBuildFile('apie.html'),
  readBuildFile('robots.txt'),
  readBuildFile('sitemap.xml'),
  readFile(path.join(outputRoot, 'social-preview.png'))
]);

for (const expected of [
  '<html lang="lt-LT">',
  '<meta name="viewport" content="width=device-width, initial-scale=1"',
  '<link rel="icon" href="data:image/svg+xml,',
  '<title>Dažniausi lietuviški žodžiai · lietuvių kalbos dažnumo duomenys</title>',
  `<link rel="canonical" href="${siteUrl}/"`,
  `<meta property="og:url" content="${siteUrl}/"`,
  `<meta property="og:image" content="${siteUrl}/social-preview.png"`,
  '<meta name="twitter:card" content="summary_large_image"'
]) {
  expectIncludes(home, expected, 'index.html');
}

for (const expected of [
  '<title>Metodika ir šaltiniai · Dažniausi lietuviški žodžiai</title>',
  `<link rel="canonical" href="${siteUrl}/apie"`,
  `<meta property="og:url" content="${siteUrl}/apie"`
]) {
  expectIncludes(methodology, expected, 'apie.html');
}

expectIncludes(robots, `Sitemap: ${siteUrl}/sitemap.xml`, 'robots.txt');
for (const route of publicRoutes) {
  expectIncludes(sitemap, `<loc>${siteUrl}/${route}</loc>`, 'sitemap.xml');
}

if (!socialImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
  throw new Error('social-preview.png is not a PNG file');
}
if (socialImage.readUInt32BE(16) !== 1200 || socialImage.readUInt32BE(20) !== 630) {
  throw new Error('social-preview.png must be 1200 by 630 pixels');
}

expectIncludes(home, 'href="./apie"', 'index.html');
expectIncludes(home, 'href="./data-products/catalog.json"', 'index.html');

await access(path.join(outputRoot, 'social-preview.svg'));

console.log(JSON.stringify({
  entry: 'verified',
  canonical: `${siteUrl}/`,
  socialImage: '1200x630 PNG',
  sitemap: 'verified'
}, null, 2));
