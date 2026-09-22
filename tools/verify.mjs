#!/usr/bin/env node
/*
 * Pre-submission verification. Checks the things the Chrome Web Store reviewer
 * and the extension loader both care about, without needing a browser.
 *
 * Run: npm run verify
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const problems = [];
const notes = [];

function fail(message) { problems.push(message); }
function ok(message) { notes.push(message); }

/* ---------- manifest ---------- */

const manifestPath = join(ROOT, 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  ok('manifest.json parses as JSON');
} catch (error) {
  fail(`manifest.json does not parse: ${error.message}`);
}

if (manifest) {
  if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
  if (!manifest.name || manifest.name.length > 45) fail(`name must be 1 to 45 characters, got ${manifest.name ? manifest.name.length : 0}`);
  if (!manifest.description || manifest.description.length > 132) fail(`description must be 1 to 132 characters, got ${manifest.description ? manifest.description.length : 0}`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) fail('version must look like 1.0.0');

  const permissions = manifest.permissions || [];
  const expected = ['activeTab', 'scripting'];
  const extra = permissions.filter((p) => !expected.includes(p));
  if (extra.length) fail(`unexpected permissions: ${extra.join(', ')}`);
  expected.forEach((p) => { if (!permissions.includes(p)) fail(`missing permission: ${p}`); });
  if (manifest.host_permissions) fail('host_permissions must not be present');
  if (manifest.optional_host_permissions) fail('optional_host_permissions must not be present');
  if (manifest.background) fail('no background service worker is needed');
  if (manifest.content_scripts) fail('no declarative content scripts should be registered');
  ok(`permissions: ${permissions.join(', ')} and no host permissions`);

  ['16', '32', '48', '128'].forEach((size) => {
    const rel = manifest.icons && manifest.icons[size];
    if (!rel) { fail(`icons.${size} missing from manifest`); return; }
    const full = join(ROOT, rel);
    if (!existsSync(full)) fail(`icon file missing: ${rel}`);
    else if (statSync(full).size < 50) fail(`icon file looks empty: ${rel}`);
  });
  ok('all four icon sizes exist on disk');

  const popup = manifest.action && manifest.action.default_popup;
  if (!popup || !existsSync(join(ROOT, popup))) fail('action.default_popup is missing or does not exist');
}

/* ---------- source files load and stay offline ---------- */

const sourceFiles = ['src/snapshot.js', 'src/analyse.js', 'popup/popup.js', 'popup/popup.html', 'popup/popup.css'];
sourceFiles.forEach((rel) => {
  if (!existsSync(join(ROOT, rel))) fail(`missing file: ${rel}`);
});

const analyse = await import(join(ROOT, 'src/analyse.js')).catch((error) => {
  fail(`src/analyse.js does not load as an ES module: ${error.message}`);
  return null;
});
if (analyse && typeof analyse.analyse === 'function') ok('src/analyse.js loads as an ES module and exports analyse()');

const snapshot = await import(join(ROOT, 'src/snapshot.js')).catch((error) => {
  fail(`src/snapshot.js does not load as an ES module: ${error.message}`);
  return null;
});
if (snapshot && typeof snapshot.collectSnapshot === 'function') {
  ok('src/snapshot.js loads as an ES module and exports collectSnapshot()');
  const body = snapshot.collectSnapshot.toString();
  if (/\bimport\s*\(|\brequire\s*\(/.test(body)) fail('collectSnapshot references import() or require(), which will break when it is injected');
}

/* ---------- forbidden patterns anywhere in the shipped code ---------- */

const FORBIDDEN = [
  { re: /\beval\s*\(/, label: 'eval(' },
  { re: /new\s+Function\s*\(/, label: 'new Function(' },
  { re: /\bfetch\s*\(/, label: 'fetch(' },
  { re: /XMLHttpRequest/, label: 'XMLHttpRequest' },
  { re: /navigator\.sendBeacon/, label: 'sendBeacon' },
  { re: /chrome\.storage/, label: 'chrome.storage' },
  { re: /<script[^>]+src=["']https?:/i, label: 'remote script tag' }
];

['src/snapshot.js', 'src/analyse.js', 'popup/popup.js', 'popup/popup.html'].forEach((rel) => {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  FORBIDDEN.forEach(({ re, label }) => {
    if (re.test(text)) fail(`${rel} contains ${label}`);
  });
});
ok('no eval, no remote code, no network calls and no storage in the shipped source');

/* ---------- popup wiring: every element the script looks up must exist ---------- */

const popupHtml = readFileSync(join(ROOT, 'popup/popup.html'), 'utf8');
const popupJs = readFileSync(join(ROOT, 'popup/popup.js'), 'utf8');

const htmlIds = new Set([...popupHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const wanted = [...popupJs.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
wanted.forEach((id) => {
  if (!htmlIds.has(id)) fail(`popup.js looks up #${id} but popup.html has no such element`);
});
ok(`popup.js looks up ${wanted.length} element ids and all of them exist in popup.html`);

if (!/<script type="module" src="popup\.js">/.test(popupHtml)) {
  fail('popup.html must load popup.js as a module');
}
if (/\son\w+=/.test(popupHtml)) {
  fail('popup.html contains an inline event handler, which the MV3 content security policy blocks');
}

/* ---------- report ---------- */

notes.forEach((n) => console.log(`  ok   ${n}`));
if (problems.length) {
  console.error('');
  problems.forEach((p) => console.error(`  FAIL ${p}`));
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
