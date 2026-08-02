import { publicRoutes, site } from '$lib/site';

export const prerender = true;

export function GET() {
  const locations = publicRoutes
    .map((route) => `  <url>\n    <loc>${site.url}/${route}</loc>\n  </url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8'
    }
  });
}
