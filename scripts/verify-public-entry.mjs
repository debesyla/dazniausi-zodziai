import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repositoryRoot, 'build');
const siteUrl = 'https://debesyla.github.io/dazniausi-zodziai';

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
  '<link rel="canonical" href="https://debesyla.github.io/dazniausi-zodziai/"',
  '<meta property="og:url" content="https://debesyla.github.io/dazniausi-zodziai/"',
  '<meta property="og:image" content="https://debesyla.github.io/dazniausi-zodziai/social-preview.png"',
  '<meta name="twitter:card" content="summary_large_image"'
]) {
  expectIncludes(home, expected, 'index.html');
}

for (const expected of [
  '<title>Metodika ir šaltiniai · Dažniausi lietuviški žodžiai</title>',
  '<link rel="canonical" href="https://debesyla.github.io/dazniausi-zodziai/apie"',
  '<meta property="og:url" content="https://debesyla.github.io/dazniausi-zodziai/apie"'
]) {
  expectIncludes(methodology, expected, 'apie.html');
}

expectIncludes(robots, `Sitemap: ${siteUrl}/sitemap.xml`, 'robots.txt');
expectIncludes(sitemap, `<loc>${siteUrl}/</loc>`, 'sitemap.xml');
expectIncludes(sitemap, `<loc>${siteUrl}/apie</loc>`, 'sitemap.xml');

if (!socialImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
  throw new Error('social-preview.png is not a PNG file');
}
if (socialImage.readUInt32BE(16) !== 1200 || socialImage.readUInt32BE(20) !== 630) {
  throw new Error('social-preview.png must be 1200 by 630 pixels');
}

if (process.env.NODE_ENV === 'production') {
  expectIncludes(home, 'href="./apie"', 'index.html');
  expectIncludes(home, 'href="./data-products/catalog.json"', 'index.html');
}

await access(path.join(outputRoot, 'social-preview.svg'));

console.log(JSON.stringify({
  entry: 'verified',
  canonical: `${siteUrl}/`,
  socialImage: '1200x630 PNG',
  sitemap: 'verified'
}, null, 2));
