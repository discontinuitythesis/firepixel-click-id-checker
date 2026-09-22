import test from 'node:test';
import assert from 'node:assert/strict';

import { analyse, buildMarkdownReport } from '../src/analyse.js';

/* ------------------------------------------------------------------ */
/* Fixture builder                                                     */
/* ------------------------------------------------------------------ */

const PARAM_NAMES = [
  'gclid', 'gbraid', 'wbraid', 'dclid', 'msclkid', 'fbclid', 'ttclid', 'li_fat_id',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'
];

const COOKIE_NAMES = [
  '_gcl_aw', '_gcl_gb', '_gcl_gs', '_gcl_dc', '_gcl_au', '_gcl_ag',
  '_uetmsclkid', '_uetsid', '_uetvid', '_fbc', '_fbp', '_ttp', '_ga'
];

function makeSnapshot(overrides = {}) {
  const params = {};
  PARAM_NAMES.forEach((name) => {
    params[name] = { present: false, value: '', length: 0 };
  });
  Object.entries(overrides.params || {}).forEach(([name, value]) => {
    params[name] = { present: true, value: String(value).slice(0, 12), length: String(value).length };
  });

  const cookies = {};
  COOKIE_NAMES.forEach((name) => {
    cookies[name] = { present: false, value: '' };
  });
  (overrides.cookies || []).forEach((name) => {
    cookies[name] = { present: true, value: 'abc123' };
  });

  return {
    schema: 1,
    url: overrides.url || 'https://example.co.uk/plumbers-london/',
    hostname: 'example.co.uk',
    referrer: overrides.referrer || '',
    title: 'Emergency plumbers in London',
    params,
    cookies,
    gclPrefixedCookies: (overrides.cookies || []).filter((c) => c.startsWith('_gcl_')),
    gaPrefixedCookies: [],
    tags: Object.assign({
      googleTag: false,
      googleTagIds: [],
      gtm: false,
      gtmIds: [],
      adsConversionIds: [],
      ga4Ids: [],
      uet: false,
      uetIds: [],
      metaPixel: false,
      metaPixelIds: [],
      clarity: false,
      tiktokPixel: false,
      linkedinInsight: false,
      sgtm: false,
      sgtmEndpoints: [],
      cmps: []
    }, overrides.tags || {}),
    consent: Object.assign({
      dataLayerPresent: false,
      dataLayerLength: 0,
      entries: [],
      hasDefault: false,
      hasUpdate: false
    }, overrides.consent || {}),
    forms: overrides.forms || [],
    iframeForms: overrides.iframeForms || [],
    hubspotEmbed: false,
    navigation: Object.assign({
      redirectCount: 0, type: 'navigate', available: true, historyLength: 1
    }, overrides.navigation || {}),
    meta: Object.assign({
      canonical: '', robots: '', telLinkCount: 0, callTrackingHints: []
    }, overrides.meta || {})
  };
}

function makeForm(overrides = {}) {
  return Object.assign({
    index: 0,
    id: 'contact-form',
    name: '',
    action: '/thank-you',
    method: 'post',
    visibleInputs: 4,
    hiddenInputCount: 0,
    hasEmailField: true,
    hiddenFields: [],
    builders: []
  }, overrides);
}

function consentEntry(mode, values = {}) {
  return Object.assign({
    mode,
    index: 0,
    region: null,
    wait_for_update: null,
    ad_storage: null,
    ad_user_data: null,
    ad_personalization: null,
    analytics_storage: null
  }, values);
}

function byId(result, id) {
  return result.checks.find((c) => c.id === id);
}

const GOOGLE_TAG = { googleTag: true, googleTagIds: ['AW-123456789'], adsConversionIds: ['AW-123456789'] };

const CONSENT_V2_GRANTED = {
  dataLayerPresent: true,
  entries: [
    consentEntry('default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' }),
    consentEntry('update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' })
  ],
  hasDefault: true,
  hasUpdate: true
};

/* ------------------------------------------------------------------ */
/* 1. Click ID in the URL                                              */
/* ------------------------------------------------------------------ */

test('1. no click ID and no click ID cookie fails outright', () => {
  const result = analyse(makeSnapshot());
  const clickId = byId(result, 'click-id-url');
  assert.equal(clickId.status, 'fail');
  assert.match(clickId.detail, /None of gclid/);
  assert.equal(result.summary.verdict, 'Not attributable as-is');
});

test('2. a click ID cookie without a URL parameter warns rather than fails', () => {
  const result = analyse(makeSnapshot({ cookies: ['_gcl_aw'] }));
  const clickId = byId(result, 'click-id-url');
  assert.equal(clickId.status, 'warn');
  assert.match(clickId.fix, /first party cookie/);
});

test('3. a click ID in the URL is reported as info and listed', () => {
  const result = analyse(makeSnapshot({ params: { gclid: 'TEST123' }, cookies: ['_gcl_aw'] }));
  const clickId = byId(result, 'click-id-url');
  assert.equal(clickId.status, 'info');
  assert.match(clickId.detail, /gclid=TEST123/);
});

/* ------------------------------------------------------------------ */
/* 2. Persistence into first party cookies                             */
/* ------------------------------------------------------------------ */

test('4. gclid plus _gcl_aw passes the persistence check', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' }, cookies: ['_gcl_aw'], tags: GOOGLE_TAG
  }));
  assert.equal(byId(result, 'persist-gclid').status, 'pass');
});

test('5. gclid with a Google tag but no _gcl_aw fails and names the usual causes', () => {
  const result = analyse(makeSnapshot({ params: { gclid: 'TEST123' }, tags: GOOGLE_TAG }));
  const persist = byId(result, 'persist-gclid');
  assert.equal(persist.status, 'fail');
  assert.match(persist.detail, /Consent Mode denies ad_storage/);
  assert.match(persist.detail, /conversion linker/);
});

test('6. gclid with no Google tag at all only warns', () => {
  const result = analyse(makeSnapshot({ params: { gclid: 'TEST123' } }));
  const persist = byId(result, 'persist-gclid');
  assert.equal(persist.status, 'warn');
  assert.match(persist.title, /no Google tag detected/);
});

test('7. gbraid and wbraid both map to _gcl_gb', () => {
  const withCookie = analyse(makeSnapshot({
    params: { gbraid: 'GB1', wbraid: 'WB1' }, cookies: ['_gcl_gb'], tags: GOOGLE_TAG
  }));
  assert.equal(byId(withCookie, 'persist-gbraid').status, 'pass');
  assert.equal(byId(withCookie, 'persist-wbraid').status, 'pass');

  const without = analyse(makeSnapshot({ params: { gbraid: 'GB1' }, tags: GOOGLE_TAG }));
  assert.equal(byId(without, 'persist-gbraid').status, 'fail');
});

test('8. fbclid needs the Meta pixel to write _fbc', () => {
  const noPixel = analyse(makeSnapshot({ params: { fbclid: 'FB1' } }));
  assert.equal(byId(noPixel, 'persist-fbclid').status, 'warn');

  const withPixel = analyse(makeSnapshot({ params: { fbclid: 'FB1' }, tags: { metaPixel: true } }));
  assert.equal(byId(withPixel, 'persist-fbclid').status, 'fail');

  const stored = analyse(makeSnapshot({
    params: { fbclid: 'FB1' }, cookies: ['_fbc'], tags: { metaPixel: true }
  }));
  assert.equal(byId(stored, 'persist-fbclid').status, 'pass');
});

/* ------------------------------------------------------------------ */
/* 3. Consent Mode                                                     */
/* ------------------------------------------------------------------ */

test('9. a denied default with no granting update fails when a click ID is present', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    tags: GOOGLE_TAG,
    consent: {
      dataLayerPresent: true,
      hasDefault: true,
      entries: [consentEntry('default', {
        ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied'
      })]
    }
  }));
  const consent = byId(result, 'consent-mode');
  assert.equal(consent.status, 'fail');
  assert.match(consent.detail, /explains the missing cookie/);
  assert.equal(byId(result, 'consent-v2').status, 'pass');
});

test('10. the same denied default only warns when there is no click ID to lose', () => {
  const result = analyse(makeSnapshot({
    tags: GOOGLE_TAG,
    consent: {
      dataLayerPresent: true,
      hasDefault: true,
      entries: [consentEntry('default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })]
    }
  }));
  assert.equal(byId(result, 'consent-mode').status, 'warn');
});

test('11. a default followed by a granting update is reported as info', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' }, cookies: ['_gcl_aw'], tags: GOOGLE_TAG, consent: CONSENT_V2_GRANTED
  }));
  const consent = byId(result, 'consent-mode');
  assert.equal(consent.status, 'info');
  assert.match(consent.title, /ad_storage granted/);
});

test('12. missing ad_user_data and ad_personalization raises the Consent Mode v2 warning', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' }, cookies: ['_gcl_aw'], tags: GOOGLE_TAG,
    consent: {
      dataLayerPresent: true,
      hasDefault: true,
      hasUpdate: true,
      entries: [
        consentEntry('default', { ad_storage: 'denied', analytics_storage: 'denied' }),
        consentEntry('update', { ad_storage: 'granted', analytics_storage: 'granted' })
      ]
    }
  }));
  const v2 = byId(result, 'consent-v2');
  assert.equal(v2.status, 'warn');
  assert.match(v2.title, /ad_user_data and ad_personalization/);
});

test('13. a consent banner with no Consent Mode commands warns', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: Object.assign({}, GOOGLE_TAG, { cmps: ['CookieYes'] }),
    consent: { dataLayerPresent: true }
  }));
  const consent = byId(result, 'consent-mode');
  assert.equal(consent.status, 'warn');
  assert.match(consent.detail, /CookieYes/);
  assert.equal(byId(result, 'consent-v2'), undefined);
});

/* ------------------------------------------------------------------ */
/* 4. Forms                                                            */
/* ------------------------------------------------------------------ */

test('14. a lead form with no click ID field fails with builder specific advice', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm({ builders: ['cf7'] })]
  }));
  const form = byId(result, 'form-0');
  assert.equal(form.status, 'fail');
  assert.match(form.title, /Contact Form 7/);
  assert.match(form.detail, /cannot be matched back to the click/);
  assert.match(form.fix, /Click ID & Referrer Capture for Contact Form 7/);
});

test('15. an empty hidden click ID field warns while the URL carries a click ID', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm({
      builders: ['gravity'],
      hiddenFields: [{ name: 'gclid', id: 'gclid', filled: false, value: '' }]
    })]
  }));
  const form = byId(result, 'form-0');
  assert.equal(form.status, 'warn');
  assert.match(form.detail, /nothing populated it/);
  assert.match(form.fix, /Gravity Forms/);
});

test('16. a populated hidden click ID field passes', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm({ hiddenFields: [{ name: 'gclid', id: '', filled: true, value: 'TEST123' }] })]
  }));
  const form = byId(result, 'form-0');
  assert.equal(form.status, 'pass');
  assert.match(form.detail, /offline conversion import/);
});

test('17. a hidden click ID field is not judged when the URL has no click ID', () => {
  const result = analyse(makeSnapshot({
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm({ hiddenFields: [{ name: 'gclid', id: '', filled: false, value: '' }] })]
  }));
  const form = byId(result, 'form-0');
  assert.equal(form.status, 'info');
  assert.match(form.fix, /Reload with a test click ID/);
});

test('18. a form with no email field and no click ID field is only informational', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm({ id: 'search', hasEmailField: false, visibleInputs: 1 })]
  }));
  assert.equal(byId(result, 'form-0').status, 'info');
});

test('19. an embedded Typeform warns and explains hidden fields in the embed URL', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    iframeForms: [{ id: 'typeform', label: 'Typeform', hasQueryString: false, src: 'https://form.typeform.com/to/abc' }]
  }));
  const frame = byId(result, 'iframe-form-0');
  assert.equal(frame.status, 'warn');
  assert.match(frame.fix, /Typeform reads hidden fields/);
});

/* ------------------------------------------------------------------ */
/* 5, 6, 7, 8. Redirects, Microsoft Ads, calls, indexing               */
/* ------------------------------------------------------------------ */

test('20. redirects with no click ID on the final URL warn and count the hops', () => {
  const result = analyse(makeSnapshot({ navigation: { redirectCount: 2 } }));
  const redirects = byId(result, 'redirects');
  assert.equal(redirects.status, 'warn');
  assert.match(redirects.title, /2 redirects/);
  assert.match(redirects.fix, /every hop must carry the query string/i);
});

test('21. msclkid with no UET tag fails, and UET with only gclid is informational', () => {
  const noUet = analyse(makeSnapshot({ params: { msclkid: 'MS1' } }));
  assert.equal(byId(noUet, 'microsoft-ads').status, 'fail');
  assert.equal(byId(noUet, 'persist-msclkid').status, 'warn');

  const googleClick = analyse(makeSnapshot({
    params: { gclid: 'TEST123' }, cookies: ['_gcl_aw'], tags: Object.assign({}, GOOGLE_TAG, { uet: true, uetIds: ['12345678'] })
  }));
  const ms = byId(googleClick, 'microsoft-ads');
  assert.equal(ms.status, 'info');
  assert.match(ms.detail, /Microsoft auto-tagging appends msclkid on Microsoft Ads clicks only/);
});

test('22. msclkid stored in _uetmsclkid passes', () => {
  const result = analyse(makeSnapshot({
    params: { msclkid: 'MS1' }, cookies: ['_uetmsclkid'], tags: { uet: true, uetIds: ['12345678'] }
  }));
  assert.equal(byId(result, 'persist-msclkid').status, 'pass');
});

test('23. telephone links without call tracking warn', () => {
  const warned = analyse(makeSnapshot({ meta: { telLinkCount: 2 } }));
  const calls = byId(warned, 'calls');
  assert.equal(calls.status, 'warn');
  assert.match(calls.fix, /Google forwarding number/);

  const tracked = analyse(makeSnapshot({
    meta: { telLinkCount: 2, callTrackingHints: ['call tracking script'] }
  }));
  assert.equal(byId(tracked, 'calls').status, 'info');

  const noPhone = analyse(makeSnapshot());
  assert.equal(byId(noPhone, 'calls'), undefined);
});

test('24. an indexable paid landing page with a form warns', () => {
  const result = analyse(makeSnapshot({
    url: 'https://example.co.uk/plumbers-london/?gclid=TEST123',
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm({ hiddenFields: [{ name: 'gclid', id: '', filled: true, value: 'TEST123' }] })],
    meta: { canonical: 'https://example.co.uk/plumbers-london/' }
  }));
  const indexing = byId(result, 'indexing');
  assert.equal(indexing.status, 'warn');
  assert.match(indexing.fix, /noindex,follow/);

  const noindexed = analyse(makeSnapshot({
    url: 'https://example.co.uk/plumbers-london/?gclid=TEST123',
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    forms: [makeForm()],
    meta: { canonical: 'https://example.co.uk/plumbers-london/', robots: 'noindex,follow' }
  }));
  assert.equal(byId(noindexed, 'indexing').status, 'info');
});

/* ------------------------------------------------------------------ */
/* 9. Summary, verdict and report                                      */
/* ------------------------------------------------------------------ */

test('25. a fully working page is reported as Attributable', () => {
  const result = analyse(makeSnapshot({
    url: 'https://example.co.uk/plumbers-london/?gclid=TEST123',
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    consent: CONSENT_V2_GRANTED,
    forms: [makeForm({ hiddenFields: [{ name: 'gclid', id: '', filled: true, value: 'TEST123' }] })],
    meta: { robots: 'noindex,follow', canonical: 'https://example.co.uk/plumbers-london/' }
  }));
  assert.equal(result.summary.fail, 0);
  assert.equal(result.summary.warn, 0);
  assert.equal(result.summary.verdict, 'Attributable');
  assert.equal(result.summary.total, result.checks.length);
});

test('26. warnings but no failures give the middle verdict', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123' },
    cookies: ['_gcl_aw'],
    tags: GOOGLE_TAG,
    consent: CONSENT_V2_GRANTED,
    forms: [makeForm({ hiddenFields: [{ name: 'gclid', id: '', filled: false, value: '' }] })],
    meta: { robots: 'noindex' }
  }));
  assert.equal(result.summary.fail, 0);
  assert.ok(result.summary.warn > 0);
  assert.equal(result.summary.verdict, 'Attributable with gaps');
});

test('27. every check has the required shape and a valid status', () => {
  const result = analyse(makeSnapshot({
    params: { gclid: 'TEST123', msclkid: 'MS1', utm_source: 'google' },
    tags: Object.assign({}, GOOGLE_TAG, { uet: true, cmps: ['OneTrust'] }),
    forms: [makeForm({ builders: ['wpforms'] }), makeForm({ index: 1, id: 'newsletter', visibleInputs: 1 })],
    navigation: { redirectCount: 1 },
    meta: { telLinkCount: 1 }
  }));
  assert.ok(result.checks.length >= 8);
  const ids = new Set();
  result.checks.forEach((c) => {
    assert.ok(['pass', 'warn', 'fail', 'info'].includes(c.status), `bad status ${c.status}`);
    assert.equal(typeof c.id, 'string');
    assert.ok(c.title.length > 0);
    assert.ok(c.detail.length > 0);
    assert.equal(typeof c.fix, 'string');
    assert.ok(!ids.has(c.id), `duplicate check id ${c.id}`);
    ids.add(c.id);
  });
});

test('28. the Markdown report carries the URL, the verdict and every check title', () => {
  const snapshot = makeSnapshot({
    url: 'https://example.co.uk/plumbers-london/?gclid=TEST123',
    params: { gclid: 'TEST123' },
    tags: GOOGLE_TAG,
    forms: [makeForm({ builders: ['cf7'] })]
  });
  const result = analyse(snapshot);
  const report = buildMarkdownReport(snapshot, result);

  assert.match(report, /^# Click ID check/);
  assert.ok(report.includes(snapshot.url));
  assert.ok(report.includes(result.summary.verdict));
  assert.ok(report.includes('Google Ads (AW-123456789)'));
  result.checks.forEach((c) => {
    assert.ok(report.includes(c.title), `report missing ${c.title}`);
  });
  assert.ok(report.includes('No page data left the browser.'));
});

test('29. analyse rejects anything that is not a snapshot object', () => {
  assert.throws(() => analyse(null), TypeError);
  assert.throws(() => analyse('nope'), TypeError);
});

test('30. the demo landing page shape produces the expected verdict', () => {
  /* Mirrors test/fixtures/landing-page.html opened with ?gclid=TEST */
  const snapshot = makeSnapshot({
    url: 'http://127.0.0.1:8123/landing-page.html?gclid=TEST',
    params: { gclid: 'TEST' },
    tags: GOOGLE_TAG,
    consent: {
      dataLayerPresent: true,
      hasDefault: true,
      entries: [consentEntry('default', {
        ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied'
      })]
    },
    forms: [
      makeForm({
        builders: ['cf7'],
        hiddenFields: [
          { name: 'gclid', id: 'gclid', filled: false, value: '' },
          { name: 'utm_source', id: 'utm_source', filled: false, value: '' }
        ]
      }),
      makeForm({ index: 1, id: 'newsletter-form', visibleInputs: 1, hiddenFields: [] })
    ],
    meta: { telLinkCount: 1, canonical: 'http://127.0.0.1:8123/landing-page.html' }
  });

  const result = analyse(snapshot);
  assert.equal(byId(result, 'click-id-url').status, 'info');
  assert.equal(byId(result, 'persist-gclid').status, 'fail');
  assert.equal(byId(result, 'consent-mode').status, 'fail');
  assert.equal(byId(result, 'consent-v2').status, 'pass');
  assert.equal(byId(result, 'form-0').status, 'warn');
  assert.equal(byId(result, 'form-1').status, 'fail');
  assert.equal(byId(result, 'calls').status, 'warn');
  assert.equal(byId(result, 'indexing').status, 'warn');
  assert.equal(result.summary.verdict, 'Not attributable as-is');
});
