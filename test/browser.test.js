/*
 * End to end check of the injected snapshot function against the demo landing page.
 *
 * This runs collectSnapshot() inside a real Chromium page, exactly as
 * chrome.scripting.executeScript would, then feeds the result to analyse().
 *
 * Playwright is not a dependency of the extension. The test skips itself when
 * Playwright is not resolvable, so `npm test` still passes on a clean machine.
 *
 *   npm i -D playwright
 *   node --test test/browser.test.js
 *
 * or point it at an existing install:
 *
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.js \
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *   node --test test/browser.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

import { collectSnapshot } from '../src/snapshot.js';
import { analyse } from '../src/analyse.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

async function loadPlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_MODULE) candidates.push(process.env.PLAYWRIGHT_MODULE);
  candidates.push('playwright');
  for (const candidate of candidates) {
    try {
      const mod = await import(candidate);
      const chromium = mod.chromium || (mod.default && mod.default.chromium);
      if (chromium) return chromium;
    } catch (error) {
      /* try the next candidate */
    }
  }
  return null;
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    const name = normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(FIXTURES, name === '/' ? 'landing-page.html' : name);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('collectSnapshot runs in a real page and analyse reports the expected result', async (t) => {
  const chromium = await loadPlaywright();
  if (!chromium) {
    t.skip('Playwright is not installed, skipping the browser test');
    return;
  }

  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    /* the demo page references googletagmanager.com; block it so the test is offline */
    await page.route('**://www.googletagmanager.com/**', (route) => route.abort());

    await page.goto(`${base}/landing-page.html?gclid=TEST`, { waitUntil: 'domcontentloaded' });
    const snapshot = await page.evaluate(collectSnapshot);

    /* --- the snapshot itself --- */
    assert.equal(snapshot.schema, 1);
    assert.ok(snapshot.url.includes('gclid=TEST'));
    assert.equal(snapshot.params.gclid.present, true);
    assert.equal(snapshot.params.gclid.value, 'TEST');
    assert.equal(snapshot.params.msclkid.present, false);

    assert.equal(snapshot.tags.googleTag, true, 'the gtag script source should be detected');
    assert.deepEqual(snapshot.tags.googleTagIds, ['AW-123456789']);
    assert.ok(snapshot.tags.adsConversionIds.includes('AW-123456789'));
    assert.equal(snapshot.tags.uet, false);

    assert.equal(snapshot.consent.dataLayerPresent, true);
    assert.equal(snapshot.consent.hasDefault, true);
    assert.equal(snapshot.consent.hasUpdate, false);
    assert.equal(snapshot.consent.entries[0].ad_storage, 'denied');
    assert.equal(snapshot.consent.entries[0].ad_user_data, 'denied');

    assert.equal(snapshot.forms.length, 2);
    const contact = snapshot.forms.find((f) => f.id === 'contact-form');
    assert.ok(contact, 'the contact form should be found');
    assert.deepEqual(contact.builders, ['cf7']);
    assert.equal(contact.hasEmailField, true);
    const gclidField = contact.hiddenFields.find((f) => f.name === 'gclid');
    assert.ok(gclidField, 'the hidden gclid field should be found');
    assert.equal(gclidField.filled, false, 'nothing on the demo page populates it');

    const newsletter = snapshot.forms.find((f) => f.id === 'newsletter-form');
    assert.equal(newsletter.hiddenFields.length, 0);
    assert.equal(newsletter.hasEmailField, true);

    assert.equal(snapshot.meta.telLinkCount, 1);
    assert.deepEqual(snapshot.meta.callTrackingHints, []);
    assert.equal(snapshot.cookies._gcl_aw.present, false);
    assert.equal(snapshot.navigation.redirectCount, 0);

    /* --- the analysis --- */
    const result = analyse(snapshot);
    const byId = (id) => result.checks.find((c) => c.id === id);

    assert.equal(byId('click-id-url').status, 'info');
    assert.equal(byId('persist-gclid').status, 'fail');
    assert.equal(byId('consent-mode').status, 'fail');
    assert.equal(byId('consent-v2').status, 'pass');
    assert.equal(byId(`form-${contact.index}`).status, 'warn');
    assert.equal(byId(`form-${newsletter.index}`).status, 'fail');
    assert.equal(byId('calls').status, 'warn');
    assert.equal(byId('indexing').status, 'warn');
    assert.equal(byId('microsoft-ads'), undefined);
    assert.equal(result.summary.verdict, 'Not attributable as-is');
    assert.ok(result.summary.fail >= 3);

    /* --- the same page without a click ID --- */
    await page.goto(`${base}/landing-page.html`, { waitUntil: 'domcontentloaded' });
    const plain = await page.evaluate(collectSnapshot);
    const plainResult = analyse(plain);
    assert.equal(plainResult.checks.find((c) => c.id === 'click-id-url').status, 'fail');
    assert.equal(plainResult.checks.find((c) => c.id === 'persist-gclid'), undefined);
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
