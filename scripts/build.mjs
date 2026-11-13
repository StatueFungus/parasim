// Erzeugt dist/ für den Webserver: vollständiges index.html, Styles, Module und version.json.
// Aufruf: node scripts/build.mjs   (Version/Commit über APP_VERSION und GIT_SHA überschreibbar)
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { renderIndex, SRC } from './page.mjs';

const DIST = new URL('../dist/', import.meta.url);

function gitSha() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = process.env.APP_VERSION || pkg.version;
const commit = process.env.GIT_SHA || gitSha();

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await cp(new URL('css/', SRC), new URL('css/', DIST), { recursive: true });
await cp(new URL('js/', SRC), new URL('js/', DIST), { recursive: true });
await cp(new URL('favicon.svg', SRC), new URL('favicon.svg', DIST));
await writeFile(new URL('index.html', DIST), await renderIndex());
await writeFile(new URL('version.json', DIST), JSON.stringify({ version, commit, builtAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`dist/ gebaut: Version ${version} (${commit})`);
