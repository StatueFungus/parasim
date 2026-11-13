// Setzt version und appVersion in charts/parasim/Chart.yaml (wird von semantic-release aufgerufen).
// Aufruf: node scripts/set-chart-version.mjs 1.2.3
import { readFile, writeFile } from 'node:fs/promises';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version ?? '')) {
  console.error(`Ungültige Version: ${version}`);
  process.exit(1);
}
const file = new URL('../charts/parasim/Chart.yaml', import.meta.url);
const chart = await readFile(file, 'utf8');
if (!/^version: /m.test(chart) || !/^appVersion: /m.test(chart)) {
  console.error('Chart.yaml: version/appVersion nicht gefunden');
  process.exit(1);
}
const next = chart.replace(/^version: .*$/m, `version: ${version}`).replace(/^appVersion: .*$/m, `appVersion: "${version}"`);
await writeFile(file, next);
console.log(`Chart.yaml auf ${version} gesetzt`);
