import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { VERSION } from '../js/version.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const FILES = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1]);

test('every cached file exists', () => {
  for (const f of FILES.filter(f => f !== './')) assert.ok(existsSync(join(ROOT, f)), `missing: ${f}`);
});

test('every app file is cached, so the app opens offline', () => {
  const shipped = ['js', 'css', 'img']
    .flatMap(dir => readdirSync(join(ROOT, dir), { recursive: true }).map(p => `${dir}/${String(p).replaceAll('\\', '/')}`))
    .filter(p => /\.(js|css|png)$/.test(p));
  for (const p of shipped) assert.ok(FILES.includes(p), `not cached: ${p}`);
});

test('sw.js and js/version.js carry the same version', () => {
  assert.match(sw, new RegExp(`const VERSION = '${VERSION.replaceAll('.', '\\.')}';`));
});
