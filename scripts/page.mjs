// Baut aus src/index.html (Seiteninhalt ohne Dokumentgerüst) ein vollständiges HTML-Dokument.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SRC = new URL('../src/', import.meta.url);

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
    head,
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
