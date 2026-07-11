// Build a single reviewable contact sheet from the QA screenshot artifacts.
// Zero dependencies. Run via `npm run qa:visual`; ship.sh opens the result
// for the mandatory visual sign-off (see docs/qa-harness.md § Visual review).
import { readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'artifacts');

let profiles;
try {
  profiles = readdirSync(root).filter(p => statSync(join(root, p)).isDirectory());
} catch {
  console.error('No artifacts directory — run `npm run qa:ship` (or `npm run qa`) first.');
  process.exit(1);
}

const sections = profiles.map(profile => {
  const pngs = readdirSync(join(root, profile)).filter(f => f.endsWith('.png')).sort();
  const cells = pngs.map(f => `
    <figure>
      <a href="./${profile}/${f}" target="_blank"><img loading="lazy" src="./${profile}/${f}" alt="${f}"></a>
      <figcaption>${f.replace('.png', '')}</figcaption>
    </figure>`).join('');
  return `<h2>${profile} <small>(${pngs.length})</small></h2><div class="grid">${cells}</div>`;
}).join('');

const html = `<!doctype html>
<meta charset="utf-8">
<title>QA artifact contact sheet</title>
<style>
  body { background: #111; color: #eee; font: 14px system-ui; padding: 1.5rem; }
  h2 { border-bottom: 1px solid #333; padding-bottom: .3rem; }
  h2 small { color: #888; font-weight: 400; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
  figure { margin: 0; }
  img { width: 100%; border: 1px solid #333; border-radius: 6px; background: #000; }
  figcaption { color: #aaa; font-size: 12px; padding-top: .25rem; text-align: center; }
</style>
<h1>QA artifacts</h1>
<p>Every widget × fixture state, refreshed by the last <code>qa:ship</code> run. Look before you push.</p>
${sections}`;

const out = join(root, 'contact-sheet.html');
writeFileSync(out, html);
console.log(`file://${out}`);
