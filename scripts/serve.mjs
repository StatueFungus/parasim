// Lokaler Entwicklungsserver ohne Abhängigkeiten: liefert src/ aus, index.html mit vollständigem Dokumentgerüst.
// Aufruf: npm start   (Port über PORT, Standard 8000)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { renderIndex, SRC } from './page.mjs';

const PORT = Number(process.env.PORT) || 8000;
const ROOT = fileURLToPath(SRC);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  try {
    if (path === '/version.json') {
      const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
      let commit = 'unknown';
      try {
        commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
      } catch {
        /* kein Git */
      }
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify({ version: `${pkg.version}-dev`, commit }));
      return;
    }
    if (path === '/' || path === '/index.html') {
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
      res.end(await renderIndex());
      return;
    }
    const file = normalize(ROOT + path);
    if (!file.startsWith(ROOT) || file.includes(`${sep}..${sep}`)) throw Object.assign(new Error('forbidden'), { code: 'ENOENT' });
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' || err.code === 'EISDIR' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
  }
}).listen(PORT, () => console.log(`ParaSim läuft auf http://localhost:${PORT}`));
