/*
 * Fire Pixel Click ID Checker - popup controller.
 *
 * The popup injects collectSnapshot() into the active tab with
 * chrome.scripting.executeScript, then analyses the returned object locally.
 * Nothing is stored and nothing is sent anywhere.
 */

import { collectSnapshot } from '../src/snapshot.js';
import { analyse, buildMarkdownReport } from '../src/analyse.js';

const els = {
  status: document.getElementById('status'),
  verdict: document.getElementById('verdict'),
  verdictLabel: document.getElementById('verdict-label'),
  verdictDetail: document.getElementById('verdict-detail'),
  verdictUrl: document.getElementById('verdict-url'),
  tally: document.getElementById('tally'),
  detected: document.getElementById('detected'),
  detectedList: document.getElementById('detected-list'),
  checks: document.getElementById('checks'),
  scan: document.getElementById('scan'),
  testClickId: document.getElementById('test-click-id'),
  copy: document.getElementById('copy'),
  fallbackUrl: document.getElementById('fallback-url')
};

const RESTRICTED_PREFIXES = [
  'chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://', 'view-source:'
];

const RESTRICTED_HOSTS = [
  'chromewebstore.google.com', 'chrome.google.com/webstore', 'microsoftedge.microsoft.com'
];

let lastSnapshot = null;
let lastAnalysis = null;

/* ---------- small helpers ---------- */

function setStatus(message, isError) {
  els.status.hidden = false;
  els.status.classList.toggle('is-error', !!isError);
  els.status.textContent = '';
  const p = document.createElement('p');
  p.className = 'status-text';
  p.textContent = message;
  els.status.appendChild(p);
}

function hideResults() {
  els.verdict.hidden = true;
  els.detected.hidden = true;
  els.checks.hidden = true;
  els.checks.textContent = '';
  els.copy.hidden = true;
  els.testClickId.hidden = true;
  els.fallbackUrl.hidden = true;
  els.fallbackUrl.textContent = '';
}

function isRestricted(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (RESTRICTED_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  if (RESTRICTED_HOSTS.some((host) => lower.includes(host))) return true;
  if (lower.startsWith('file://') && lower.endsWith('.pdf')) return true;
  return false;
}

function describeTags(snapshot) {
  const tags = snapshot.tags || {};
  const found = [];
  if (tags.googleTag) {
    found.push('Google tag' + (tags.googleTagIds.length ? ` (${tags.googleTagIds.join(', ')})` : ''));
  }
  if (tags.gtm) {
    found.push('GTM' + (tags.gtmIds.length ? ` (${tags.gtmIds.join(', ')})` : ''));
  }
  if (tags.adsConversionIds.length) found.push(`Google Ads ${tags.adsConversionIds.join(', ')}`);
  if (tags.uet) found.push('Microsoft UET' + (tags.uetIds.length ? ` (${tags.uetIds.join(', ')})` : ''));
  if (tags.metaPixel) found.push('Meta pixel');
  if (tags.tiktokPixel) found.push('TikTok pixel');
  if (tags.linkedinInsight) found.push('LinkedIn Insight');
  if (tags.clarity) found.push('Clarity');
  if (tags.sgtm) found.push(`Server side container (${tags.sgtmEndpoints.join(', ')})`);
  if (tags.cmps.length) found.push(`Consent banner: ${tags.cmps.join(', ')}`);
  return found;
}

/* ---------- rendering ---------- */

function renderTally(summary) {
  els.tally.textContent = '';
  [['fail', summary.fail], ['warn', summary.warn], ['pass', summary.pass], ['info', summary.info]]
    .forEach(([kind, count]) => {
      if (!count) return;
      const li = document.createElement('li');
      li.dataset.kind = kind;
      li.textContent = `${count} ${kind}`;
      els.tally.appendChild(li);
    });
}

function renderChecks(analysis) {
  els.checks.textContent = '';
  analysis.checks.forEach((item, index) => {
    const li = document.createElement('li');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'check-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', `check-body-${index}`);

    const pip = document.createElement('span');
    pip.className = 'pip';
    pip.dataset.status = item.status;
    pip.setAttribute('role', 'img');
    pip.setAttribute('aria-label', item.status);

    const title = document.createElement('span');
    title.className = 'check-title';
    title.textContent = item.title;

    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '▾';

    toggle.append(pip, title, chevron);

    const body = document.createElement('div');
    body.className = 'check-body';
    body.id = `check-body-${index}`;
    body.hidden = true;

    const detail = document.createElement('p');
    detail.textContent = item.detail;
    body.appendChild(detail);

    if (item.fix) {
      const fix = document.createElement('p');
      fix.className = 'check-fix';
      const label = document.createElement('strong');
      label.textContent = 'How to fix';
      fix.appendChild(label);
      fix.appendChild(document.createTextNode(item.fix));
      body.appendChild(fix);
    }

    toggle.addEventListener('click', () => {
      const open = body.hidden;
      body.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      chevron.textContent = open ? '▴' : '▾';
    });

    if (item.status === 'fail' || item.status === 'warn') {
      body.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      chevron.textContent = '▴';
    }

    li.append(toggle, body);
    els.checks.appendChild(li);
  });
  els.checks.hidden = false;
}

function render(snapshot, analysis) {
  els.status.hidden = true;

  const summary = analysis.summary;
  els.verdict.hidden = false;
  els.verdict.classList.remove('is-fail', 'is-warn', 'is-pass');
  els.verdict.classList.add(summary.fail ? 'is-fail' : (summary.warn ? 'is-warn' : 'is-pass'));
  els.verdictLabel.textContent = summary.verdict;
  els.verdictDetail.textContent = summary.verdictDetail;
  els.verdictUrl.textContent = snapshot.url || '';
  renderTally(summary);

  const detected = describeTags(snapshot);
  els.detected.hidden = false;
  els.detectedList.textContent = detected.length ? detected.join(' · ') : 'No tracking tag recognised in the page source.';

  renderChecks(analysis);

  els.copy.hidden = false;
  els.copy.textContent = 'Copy report';

  const hasClickId = ['gclid', 'gbraid', 'wbraid', 'msclkid']
    .some((p) => snapshot.params && snapshot.params[p] && snapshot.params[p].present);
  els.testClickId.hidden = hasClickId;
}

/* ---------- scanning ---------- */

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

async function scan() {
  hideResults();
  setStatus('Scanning this page…');
  els.scan.disabled = true;

  let tab;
  try {
    tab = await getActiveTab();
  } catch (error) {
    els.scan.disabled = false;
    setStatus('Could not read the active tab. Close the popup and try again.', true);
    return;
  }

  if (!tab || typeof tab.id !== 'number') {
    els.scan.disabled = false;
    setStatus('No active tab to scan.', true);
    return;
  }

  if (isRestricted(tab.url)) {
    els.scan.disabled = false;
    setStatus('This is a browser page, so Chrome does not allow extensions to read it. Open the landing page you want to check and scan again.', true);
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectSnapshot
    });
    const snapshot = results && results[0] ? results[0].result : null;
    if (!snapshot) {
      els.scan.disabled = false;
      setStatus('The page returned nothing to check. It may still be loading, or it may be a PDF or a browser page.', true);
      return;
    }
    lastSnapshot = snapshot;
    lastAnalysis = analyse(snapshot);
    render(lastSnapshot, lastAnalysis);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (/cannot be scripted|Cannot access|chrome:\/\/|extensions gallery|Missing host permission/i.test(message)) {
      setStatus('Chrome does not allow extensions to read this page. This applies to browser pages, the Chrome Web Store and PDF viewers. Open a normal web page and scan again.', true);
    } else {
      setStatus(`The page could not be scanned: ${message}`, true);
    }
  } finally {
    els.scan.disabled = false;
  }
}

/* ---------- actions ---------- */

function testClickIdUrl(current) {
  const url = new URL(current);
  url.searchParams.set('gclid', `FIREPIXEL_TEST_${Date.now()}`);
  url.searchParams.set('msclkid', 'FIREPIXELTEST');
  return url.toString();
}

async function reloadWithTestClickId() {
  if (!lastSnapshot || !lastSnapshot.url) return;
  let target;
  try {
    target = testClickIdUrl(lastSnapshot.url);
  } catch (error) {
    setStatus('This page URL could not be rewritten with a test click ID.', true);
    return;
  }

  try {
    const tab = await getActiveTab();
    if (!tab || typeof tab.id !== 'number') throw new Error('no tab');
    await chrome.tabs.update(tab.id, { url: target });
    window.close();
  } catch (error) {
    els.fallbackUrl.hidden = false;
    els.fallbackUrl.textContent = '';
    const line = document.createTextNode('Chrome would not navigate the tab from here. Copy this URL into the address bar instead:');
    const code = document.createElement('code');
    code.textContent = target;
    els.fallbackUrl.append(line, code);
  }
}

async function copyReport() {
  if (!lastSnapshot || !lastAnalysis) return;
  const markdown = buildMarkdownReport(lastSnapshot, lastAnalysis);
  try {
    await navigator.clipboard.writeText(markdown);
    els.copy.textContent = 'Report copied';
  } catch (error) {
    els.copy.textContent = 'Copy blocked';
  }
  setTimeout(() => { els.copy.textContent = 'Copy report'; }, 2200);
}

els.scan.addEventListener('click', scan);
els.testClickId.addEventListener('click', reloadWithTestClickId);
els.copy.addEventListener('click', copyReport);

scan();
