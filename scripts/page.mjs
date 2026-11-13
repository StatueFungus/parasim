// Baut aus src/index.html (Seiteninhalt ohne Dokumentgerüst) ein vollständiges HTML-Dokument.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SRC = new URL('../src/', import.meta.url);

// Gleiche Policy wie im nginx-Header (deploy/nginx/security-headers.conf), ohne frame-ancestors,
// das per Meta-Tag nicht wirkt. Greift dort, wo keine eigenen Header möglich sind (GitHub Pages).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export async function renderIndex() {
  const page = await readFile(new URL('index.html', SRC), 'utf8');
  const split = page.indexOf('<div id="app">');
  if (split < 0) throw new Error('src/index.html: <div id="app"> nicht gefunden');
  const head = page.slice(0, split).replace('<meta charset="utf-8">\n', '').trim();
  const body = page.slice(split).trim();
  return [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<meta name="theme-color" content="#0d1822">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    head,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
