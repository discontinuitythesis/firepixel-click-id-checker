/*
 * Fire Pixel Click ID Checker - analysis rules.
 *
 * Pure functions. No DOM, no network, no browser APIs, so the same code runs
 * in the popup as an ES module and in Node for the test suite.
 *
 * analyse(snapshot) -> { checks: [...], summary: {...} }
 * Each check is { id, status: 'pass'|'warn'|'fail'|'info', title, detail, fix }.
 */

const CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid'];
const ALL_CLICK_ID_PARAMS = ['gclid', 'gbraid', 'wbraid', 'msclkid', 'dclid', 'fbclid', 'ttclid'];

const CLICK_ID_FIELD_RE = /gclid|gbraid|wbraid|msclkid|dclid|fbclid|ttclid|click.?id/i;
const CONTEXT_FIELD_RE = /utm_|referr|landing|source|campaign|keyword|medium/i;

const BUILDER_FIX = {
  cf7: 'Contact Form 7 does not populate hidden fields on its own. Fire Pixel publishes a free plugin, "Click ID & Referrer Capture for Contact Form 7", which adds the hidden fields and fills them from the query string and a first party cookie. Otherwise add a [hidden gclid] tag and your own script.',
  gravity: 'In Gravity Forms, open the field, tick "Allow field to be populated dynamically" and set the parameter name to gclid, then enable "Save and populate from cookie" or add a query string default so the value survives a page view without the parameter.',
  wpforms: 'In WPForms, add a Hidden Field, set its Default Value to the Smart Tag {query_var key="gclid"}, and store a first party cookie fallback so the value survives internal navigation.',
  ninja: 'In Ninja Forms, add a Hidden field and set its Default Value to "Query String" with the key gclid.',
  hubspot: 'HubSpot forms need a hidden property (for example gclid) on the form and the HubSpot tracking code on the page. HubSpot fills a hidden field from the query string when the internal name matches the parameter exactly.',
  elementor: 'In Elementor, add a Hidden field and set Field Value to "Get from URL" with the parameter name gclid, or use Shortcode with your own reader.',
  mailchimp: 'Add a hidden field to the Mailchimp for WordPress form and populate it with a small script that reads the query string and a first party cookie.',
  fluent: 'In Fluent Forms, add a Hidden field and set Value Type to "Dynamic Value" then choose the HTTP query parameter gclid.',
  formidable: 'In Formidable Forms, add a Hidden field and set its default value to the [get param=gclid] shortcode.',
  generic: 'Add a hidden input named gclid (plus gbraid, wbraid and msclkid) to the form and populate it on page load from the query string, falling back to a first party cookie so it still works when the visitor browses to another page before converting.'
};

const IFRAME_FIX = {
  typeform: 'Typeform reads hidden fields from the embed URL. Add hidden fields in the Typeform builder, then append them to the iframe source, for example #gclid=xxxx, using a small script that reads the query string.',
  tally: 'Tally reads hidden fields from the iframe query string. Create the hidden fields in Tally, then append ?gclid=xxxx to the embed URL from the parent page.',
  hubspot: 'HubSpot forms need a hidden property on the form and the HubSpot tracking code on the page so the query string is carried into the submission.',
  jotform: 'Jotform prefills hidden fields from the iframe query string. Add the field in the builder, then append it to the embed URL.',
  calendly: 'Calendly passes UTM and custom parameters through the booking URL. Append the click ID as a custom question value so it reaches your CRM.',
  gforms: 'Google Forms prefills answers from a prefilled link. Build one, then append the click ID value to the iframe source from the parent page.'
};

function has(snapshot, param) {
  return !!(snapshot && snapshot.params && snapshot.params[param] && snapshot.params[param].present);
}

function cookiePresent(snapshot, name) {
  return !!(snapshot && snapshot.cookies && snapshot.cookies[name] && snapshot.cookies[name].present);
}

function paramValue(snapshot, param) {
  if (!has(snapshot, param)) return '';
  return snapshot.params[param].value;
}

function googleTagDetected(snapshot) {
  const tags = (snapshot && snapshot.tags) || {};
  return !!(tags.googleTag || tags.gtm || (tags.adsConversionIds && tags.adsConversionIds.length) || tags.sgtm);
}

function clickIdsInUrl(snapshot) {
  return ALL_CLICK_ID_PARAMS.filter((p) => has(snapshot, p));
}

function adClickIdsInUrl(snapshot) {
  return CLICK_ID_PARAMS.filter((p) => has(snapshot, p));
}

function anyClickIdCookie(snapshot) {
  const named = ['_gcl_aw', '_gcl_gb', '_gcl_gs', '_gcl_dc', '_uetmsclkid', '_fbc'];
  if (named.some((n) => cookiePresent(snapshot, n))) return true;
  const gcl = (snapshot && snapshot.gclPrefixedCookies) || [];
  return gcl.some((n) => n !== '_gcl_au' && n !== '_gcl_ag');
}

function check(id, status, title, detail, fix) {
  return { id, status, title, detail, fix: fix || '' };
}

/* ------------------------------------------------------------------ */
/* 1. Is there a click ID on this URL at all?                          */
/* ------------------------------------------------------------------ */

function checkClickIdInUrl(snapshot) {
  const found = clickIdsInUrl(snapshot);
  if (found.length) {
    const listed = found.map((p) => `${p}=${paramValue(snapshot, p)}`).join(', ');
    return check(
      'click-id-url',
      'info',
      'Click ID found in the URL',
      `This URL carries ${listed}. The remaining checks test whether that value survives long enough to reach your CRM.`,
      ''
    );
  }
  if (anyClickIdCookie(snapshot)) {
    return check(
      'click-id-url',
      'warn',
      'No click ID in this URL, but a click ID cookie exists',
      'The current URL has no gclid, gbraid, wbraid or msclkid, yet the browser holds a Google or Microsoft click ID cookie from an earlier ad click. Conversions will still be matched by the tag, but a form submitted from this page can only carry the click ID if your form script reads the cookie as well as the query string.',
      'Make the form population script read the first party cookie (for example _gcl_aw) when the query string is empty, so visitors who browse before converting are still attributed.'
    );
  }
  return check(
    'click-id-url',
    'fail',
    'No click ID on this URL',
    'None of gclid, gbraid, wbraid or msclkid is present in the query string and no click ID cookie was found. Nothing on this page view can be traced back to an ad click.',
    'Open the page from a real ad, or use the "Reload with a test click ID" button to simulate one. If you reached this page from an ad and the parameter is missing, check auto-tagging in Google Ads, the redirect chain and any URL rewriting on your server or CDN.'
  );
}

/* ------------------------------------------------------------------ */
/* 2. Did the tag persist the click ID into a first party cookie?      */
/* ------------------------------------------------------------------ */

const PERSISTENCE_RULES = [
  {
    param: 'gclid',
    cookie: '_gcl_aw',
    platform: 'Google Ads',
    tagName: 'Google tag',
    detect: (s) => googleTagDetected(s)
  },
  {
    param: 'gbraid',
    cookie: '_gcl_gb',
    platform: 'Google Ads (app to web)',
    tagName: 'Google tag',
    detect: (s) => googleTagDetected(s)
  },
  {
    param: 'wbraid',
    cookie: '_gcl_gb',
    platform: 'Google Ads (web to app)',
    tagName: 'Google tag',
    detect: (s) => googleTagDetected(s)
  },
  {
    param: 'dclid',
    cookie: '_gcl_dc',
    platform: 'Display & Video 360',
    tagName: 'Google tag',
    detect: (s) => googleTagDetected(s)
  },
  {
    param: 'msclkid',
    cookie: '_uetmsclkid',
    platform: 'Microsoft Ads',
    tagName: 'UET tag',
    detect: (s) => !!(s.tags && s.tags.uet)
  },
  {
    param: 'fbclid',
    cookie: '_fbc',
    platform: 'Meta',
    tagName: 'Meta pixel',
    detect: (s) => !!(s.tags && s.tags.metaPixel)
  }
];

function checkPersistence(snapshot) {
  const out = [];
  PERSISTENCE_RULES.forEach((rule) => {
    if (!has(snapshot, rule.param)) return;
    const id = `persist-${rule.param}`;
    const cookieThere = cookiePresent(snapshot, rule.cookie);
    const tagThere = rule.detect(snapshot);

    if (cookieThere) {
      out.push(check(
        id,
        'pass',
        `${rule.param} stored in ${rule.cookie}`,
        `The ${rule.tagName} wrote ${rule.cookie} on this page, so ${rule.platform} can match a later conversion back to this click for the life of the cookie.`,
        ''
      ));
      return;
    }

    if (tagThere) {
      out.push(check(
        id,
        'fail',
        `${rule.param} was not written to ${rule.cookie}`,
        `The ${rule.tagName} is on the page but ${rule.cookie} is missing. Common causes: Consent Mode denies ad_storage and no update to granted has run, the tag is held back until the visitor accepts cookies, the conversion linker is switched off, or the tag fired on a different hostname to the one you are on.`,
        `Check the Consent Mode state below, confirm the conversion linker is enabled in your Google tag or GTM container, and confirm the ${rule.tagName} fires on this page view rather than only after consent. Then reload with a test click ID and look for ${rule.cookie} in Application, Cookies.`
      ));
      return;
    }

    out.push(check(
      id,
      'warn',
      `${rule.param} present but no ${rule.tagName} detected`,
      `This URL carries ${rule.param} and ${rule.cookie} is missing, but no ${rule.tagName} was found in the page source either. Nothing is available to store the click ID.`,
      `Install the ${rule.tagName} on this landing page, or confirm it loads through a tag manager that this checker cannot see from the page source (for example a server side container on a different subdomain).`
    ));
  });

  if (!out.length && clickIdsInUrl(snapshot).length === 0) {
    out.push(check(
      'persist-none',
      'info',
      'Click ID storage not tested',
      'There is no click ID in the URL, so there is nothing for the tag to store on this page view. Reload with a test click ID to test cookie writing.',
      ''
    ));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Consent Mode                                                     */
/* ------------------------------------------------------------------ */

function latestState(entries, key) {
  let value = null;
  entries.forEach((entry) => {
    if (entry[key]) value = String(entry[key]).toLowerCase();
  });
  return value;
}

function checkConsent(snapshot) {
  const out = [];
  const consent = (snapshot && snapshot.consent) || { entries: [] };
  const entries = consent.entries || [];
  const cmps = (snapshot.tags && snapshot.tags.cmps) || [];
  const hasClickId = adClickIdsInUrl(snapshot).length > 0;

  const defaults = entries.filter((e) => e.mode === 'default');
  const updates = entries.filter((e) => e.mode === 'update');

  const defaultAdStorage = latestState(defaults, 'ad_storage');
  const updateAdStorage = latestState(updates, 'ad_storage');

  if (defaults.length && defaultAdStorage === 'denied' && updateAdStorage !== 'granted') {
    out.push(check(
      'consent-mode',
      hasClickId ? 'fail' : 'warn',
      'Consent Mode denies ad_storage and nothing has granted it',
      `A consent default sets ad_storage to denied${updates.length ? ' and the updates seen so far do not grant it' : ' and no consent update has run on this page view'}. While ad_storage is denied the Google tag cannot write _gcl_aw, so the click ID is not stored in a first party cookie.${hasClickId ? ' This explains the missing cookie above.' : ''}`,
      'This is expected before a visitor accepts cookies. Accept cookies in your banner and scan again: ad_storage should move to granted and _gcl_aw should appear. If it does not, the consent update is not reaching the Google tag. Check that your CMP runs before the Google tag and that it pushes gtag("consent", "update", ...) rather than only blocking scripts.'
    ));
  } else if (defaults.length && updateAdStorage === 'granted') {
    out.push(check(
      'consent-mode',
      'info',
      'Consent Mode default and update found, ad_storage granted',
      `A consent default is set and a later update grants ad_storage. ${defaults.length} default and ${updates.length} update command were seen in the dataLayer.`,
      ''
    ));
  } else if (defaults.length) {
    out.push(check(
      'consent-mode',
      'info',
      'Consent Mode default found',
      `A consent default is set with ad_storage ${defaultAdStorage || 'not specified'}${updates.length ? ` and ${updates.length} update command was seen` : ' and no update has run yet on this page view'}.`,
      ''
    ));
  } else if (cmps.length) {
    out.push(check(
      'consent-mode',
      'warn',
      'A consent banner was detected but no Consent Mode default was found',
      `${cmps.join(', ')} was detected on the page, but no gtag("consent", "default", ...) command was found in the dataLayer. The banner is probably blocking tags outright rather than using Consent Mode, which means Google receives no modelled conversions at all from visitors who have not yet accepted.`,
      'Switch the banner to Consent Mode v2, so a default of denied is set before the Google tag loads and an update is sent when the visitor accepts. Consent Mode is also required for Google Ads personalisation features in the EEA and the UK.'
    ));
  } else if (consent.dataLayerPresent) {
    out.push(check(
      'consent-mode',
      'info',
      'No Consent Mode commands found',
      'A dataLayer exists but it contains no consent default or update commands, and no consent banner was detected. If this site serves the UK or EEA, Consent Mode v2 is required for Google Ads audience features.',
      ''
    ));
  } else {
    out.push(check(
      'consent-mode',
      'info',
      'No dataLayer on this page',
      'No dataLayer was found, so Consent Mode state could not be read. This is normal on pages with no Google tag or a purely server side setup.',
      ''
    ));
  }

  if (entries.length) {
    const missing = [];
    ['ad_user_data', 'ad_personalization'].forEach((key) => {
      const seen = entries.some((e) => e[key]);
      if (!seen) missing.push(key);
    });
    if (missing.length) {
      out.push(check(
        'consent-v2',
        'warn',
        `Consent Mode v2 signal missing: ${missing.join(' and ')}`,
        `Consent commands were found, but ${missing.join(' and ')} was never set. Consent Mode v2 requires ad_user_data and ad_personalization alongside ad_storage and analytics_storage. Without them, Google Ads remarketing and enhanced conversions features are restricted for UK and EEA traffic.`,
        `Add ${missing.join(' and ')} to both the consent default and the consent update in your CMP or tag template.`
      ));
    } else {
      out.push(check(
        'consent-v2',
        'pass',
        'Consent Mode v2 signals present',
        'ad_user_data and ad_personalization are set alongside ad_storage, which is what Consent Mode v2 requires.',
        ''
      ));
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* 4. Form capture                                                     */
/* ------------------------------------------------------------------ */

function builderFix(builders) {
  if (!builders || !builders.length) return BUILDER_FIX.generic;
  const known = builders.find((b) => BUILDER_FIX[b]);
  return known ? BUILDER_FIX[known] : BUILDER_FIX.generic;
}

function builderLabel(builders) {
  const labels = {
    cf7: 'Contact Form 7',
    gravity: 'Gravity Forms',
    wpforms: 'WPForms',
    ninja: 'Ninja Forms',
    hubspot: 'HubSpot',
    elementor: 'Elementor Forms',
    mailchimp: 'Mailchimp for WordPress',
    fluent: 'Fluent Forms',
    formidable: 'Formidable Forms'
  };
  if (!builders || !builders.length) return '';
  const named = builders.map((b) => labels[b]).filter(Boolean);
  return named.length ? named[0] : '';
}

function formName(form) {
  if (form.id) return `#${form.id}`;
  if (form.name) return `"${form.name}"`;
  if (form.action) return form.action;
  return `form ${form.index + 1}`;
}

function checkForms(snapshot) {
  const out = [];
  const forms = (snapshot && snapshot.forms) || [];
  const iframeForms = (snapshot && snapshot.iframeForms) || [];
  const urlClickIds = adClickIdsInUrl(snapshot);
  const hasClickId = urlClickIds.length > 0;

  if (!forms.length && !iframeForms.length) {
    out.push(check(
      'forms-none',
      'info',
      'No form found on this page',
      'No form element and no known embedded form was found. If leads arrive by telephone or email from this page, see the call tracking check below.',
      ''
    ));
    return out;
  }

  forms.forEach((form) => {
    const id = `form-${form.index}`;
    const label = builderLabel(form.builders);
    const suffix = label ? ` (${label})` : '';
    const hidden = form.hiddenFields || [];
    const clickIdFields = hidden.filter((f) => CLICK_ID_FIELD_RE.test(`${f.name} ${f.id}`));
    const contextFields = hidden.filter((f) => CONTEXT_FIELD_RE.test(`${f.name} ${f.id}`));
    const filled = clickIdFields.filter((f) => f.filled);

    if (!clickIdFields.length) {
      if (form.hasEmailField) {
        out.push(check(
          id,
          'fail',
          `${formName(form)}${suffix} collects an email address but captures no click ID`,
          `This form has ${form.visibleInputs} visible field${form.visibleInputs === 1 ? '' : 's'} including an email address, and no hidden field for gclid, gbraid, wbraid or msclkid.${contextFields.length ? ` It does capture ${contextFields.map((f) => f.name || f.id).join(', ')}, so the mechanism for hidden fields already exists.` : ''} Leads from this form cannot be matched back to the click for offline conversion import unless your CRM captures the click ID some other way.`,
          builderFix(form.builders)
        ));
      } else {
        out.push(check(
          id,
          'info',
          `${formName(form)}${suffix} has no click ID field`,
          `This form has ${form.visibleInputs} visible field${form.visibleInputs === 1 ? '' : 's'} and no email address field, so it may be a search or newsletter form rather than a lead form. It captures no click ID.`,
          'If this form does generate leads, add a hidden gclid field and populate it on page load.'
        ));
      }
      return;
    }

    const names = clickIdFields.map((f) => f.name || f.id).join(', ');

    if (!hasClickId) {
      out.push(check(
        id,
        'info',
        `${formName(form)}${suffix} has a click ID field, population not tested`,
        `Hidden field${clickIdFields.length === 1 ? '' : 's'} found: ${names}. There is no click ID in this URL, so this checker cannot tell whether the field would be populated.`,
        'Use the "Reload with a test click ID" button, then scan again. The field should hold the test value.'
      ));
      return;
    }

    if (filled.length) {
      out.push(check(
        id,
        'pass',
        `${formName(form)}${suffix} captures the click ID`,
        `Hidden field${filled.length === 1 ? '' : 's'} ${filled.map((f) => f.name || f.id).join(', ')} ${filled.length === 1 ? 'is' : 'are'} populated while the URL carries ${urlClickIds.join(', ')}. A lead from this form can be matched back to the ad click for offline conversion import.`,
        ''
      ));
      return;
    }

    out.push(check(
      id,
      'warn',
      `${formName(form)}${suffix} has an empty click ID field`,
      `The hidden field${clickIdFields.length === 1 ? '' : 's'} ${names} exist${clickIdFields.length === 1 ? 's' : ''} but nothing populated ${clickIdFields.length === 1 ? 'it' : 'them'} even though the URL carries ${urlClickIds.join(', ')}. The script that copies the click ID has either not run, run before the field existed, or is looking for a different parameter name.`,
      `${builderFix(form.builders)} If the form is injected by JavaScript, populate the field after the form renders rather than on DOMContentLoaded.`
    ));
  });

  iframeForms.forEach((frame, i) => {
    out.push(check(
      `iframe-form-${i}`,
      'warn',
      `${frame.label} form is embedded in an iframe`,
      `An embedded ${frame.label} form was found. This checker cannot see inside a third party iframe, so it cannot confirm the click ID is carried into the submission.${frame.hasQueryString ? ' The embed URL does carry a query string, which is where hidden values would be passed.' : ' The embed URL carries no query string, so no hidden values are being passed in.'}`,
      IFRAME_FIX[frame.id] || 'Pass the click ID into the embed URL as a hidden field parameter and confirm the value arrives in a test submission.'
    ));
  });

  return out;
}

/* ------------------------------------------------------------------ */
/* 5. Redirects                                                        */
/* ------------------------------------------------------------------ */

function checkRedirects(snapshot) {
  const nav = (snapshot && snapshot.navigation) || {};
  const count = nav.redirectCount || 0;
  const hasClickId = adClickIdsInUrl(snapshot).length > 0;

  if (count > 0 && !hasClickId) {
    return check(
      'redirects',
      'warn',
      `Reached through ${count} redirect${count === 1 ? '' : 's'} and the URL has no click ID`,
      `The browser followed ${count} redirect${count === 1 ? '' : 's'} before arriving here, and the final URL carries no click ID. Click IDs are very often dropped at a redirect.`,
      'Check the final URL in Google Ads, then test the redirect chain with a click ID appended. Every hop must carry the query string through, including any http to https, trailing slash, www and geo redirects, and any consent or age gate.'
    );
  }

  if (count > 0) {
    return check(
      'redirects',
      'info',
      `Reached through ${count} redirect${count === 1 ? '' : 's'}, click ID survived`,
      `The browser followed ${count} redirect${count === 1 ? '' : 's'} and the click ID is still on the final URL, so the chain preserves the query string.`,
      ''
    );
  }

  return check(
    'redirects',
    'info',
    'No same origin redirects recorded',
    'The Navigation Timing API recorded no redirects for this page view. Note that redirects across different origins are hidden from this API, so a cross domain hop may still have happened.',
    ''
  );
}

/* ------------------------------------------------------------------ */
/* 6. Microsoft Ads                                                    */
/* ------------------------------------------------------------------ */

function checkMicrosoft(snapshot) {
  const tags = (snapshot && snapshot.tags) || {};
  const msclkid = has(snapshot, 'msclkid');

  if (msclkid && !tags.uet) {
    return check(
      'microsoft-ads',
      'fail',
      'msclkid present but no UET tag found',
      'This URL carries a Microsoft Ads click ID, but no Universal Event Tracking tag was found on the page. Without UET the click ID is never stored, so conversions and offline conversion imports cannot be matched.',
      'Install the UET tag on this landing page, ideally through your tag manager, and switch on auto-tagging in Microsoft Advertising so msclkid is appended to ad clicks.'
    );
  }

  if (tags.uet && !msclkid && has(snapshot, 'gclid')) {
    return check(
      'microsoft-ads',
      'info',
      'UET tag present, this visit is a Google click',
      `A UET tag was found${tags.uetIds && tags.uetIds.length ? ` (tag id ${tags.uetIds.join(', ')})` : ''}. The URL carries gclid rather than msclkid, which is expected: Microsoft auto-tagging appends msclkid on Microsoft Ads clicks only. Test a Microsoft click separately.`,
      ''
    );
  }

  if (tags.uet) {
    return check(
      'microsoft-ads',
      'info',
      'UET tag present',
      `A Microsoft UET tag was found on the page${tags.uetIds && tags.uetIds.length ? ` (tag id ${tags.uetIds.join(', ')})` : ''}. Open this page from a Microsoft Ads click to test msclkid capture.`,
      ''
    );
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* 7. Telephone leads                                                  */
/* ------------------------------------------------------------------ */

function checkCalls(snapshot) {
  const meta = (snapshot && snapshot.meta) || {};
  const count = meta.telLinkCount || 0;
  if (!count) return null;

  const hints = meta.callTrackingHints || [];
  if (hints.length) {
    return check(
      'calls',
      'info',
      'Telephone links with call tracking signs',
      `${count} telephone link${count === 1 ? '' : 's'} found, and the page shows signs of call tracking (${hints.join(', ')}). Confirm that the call record carries the click ID and not only the source, otherwise offline conversion import will still fail.`,
      ''
    );
  }

  return check(
    'calls',
    'warn',
    `${count} telephone link${count === 1 ? '' : 's'} with no call tracking detected`,
    'Visitors who telephone from this page leave no click ID behind, so those leads cannot be imported back into Google Ads as offline conversions. No call tracking script or number swapping attribute was detected.',
    'Either use a call tracking product that records the click ID against the call, or use Google Ads call reporting with a Google forwarding number so calls are counted as conversions in the account.'
  );
}

/* ------------------------------------------------------------------ */
/* 8. Canonical and robots                                             */
/* ------------------------------------------------------------------ */

function stripQuery(url) {
  if (!url) return '';
  const cut = url.split('#')[0].split('?')[0];
  return cut.replace(/\/$/, '');
}

function checkIndexing(snapshot) {
  const meta = (snapshot && snapshot.meta) || {};
  const robots = (meta.robots || '').toLowerCase();
  const noindex = robots.indexOf('noindex') !== -1;
  const hasClickId = adClickIdsInUrl(snapshot).length > 0;
  const hasForm = ((snapshot && snapshot.forms) || []).length > 0;
  const canonicalSelf = !!meta.canonical && stripQuery(meta.canonical) === stripQuery(snapshot.url);

  if (hasClickId && hasForm && !noindex && canonicalSelf) {
    return check(
      'indexing',
      'warn',
      'Paid landing page appears indexable',
      'This page carries a click ID and holds a lead form, has no noindex directive, and its canonical points at itself. That is fine for a page that doubles as an organic landing page, but a dedicated paid landing page in the index can pick up organic traffic that muddles your paid reporting and conversion rates.',
      'If the page exists only for paid traffic, add <meta name="robots" content="noindex,follow">. If it serves both, make sure the canonical is the clean URL with no query string and that paid and organic traffic can be separated in reporting.'
    );
  }

  return check(
    'indexing',
    'info',
    'Indexing directives',
    `Robots meta: ${meta.robots ? meta.robots : 'none'}. Canonical: ${meta.canonical ? meta.canonical : 'none'}.`,
    ''
  );
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

export function analyse(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('analyse() expects a snapshot object');
  }

  const checks = [];
  checks.push(checkClickIdInUrl(snapshot));
  checkPersistence(snapshot).forEach((c) => checks.push(c));
  checkConsent(snapshot).forEach((c) => checks.push(c));
  checkForms(snapshot).forEach((c) => checks.push(c));
  checks.push(checkRedirects(snapshot));

  const microsoft = checkMicrosoft(snapshot);
  if (microsoft) checks.push(microsoft);

  const calls = checkCalls(snapshot);
  if (calls) checks.push(calls);

  checks.push(checkIndexing(snapshot));

  const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
  checks.forEach((c) => { counts[c.status] += 1; });

  let verdict;
  let verdictDetail;
  if (counts.fail > 0) {
    verdict = 'Not attributable as-is';
    verdictDetail = `${counts.fail} blocking problem${counts.fail === 1 ? '' : 's'} found. A lead from this page would not be matched back to the ad click.`;
  } else if (counts.warn > 0) {
    verdict = 'Attributable with gaps';
    verdictDetail = `Nothing is broken outright, but ${counts.warn} thing${counts.warn === 1 ? '' : 's'} could lose the click ID in real conditions.`;
  } else {
    verdict = 'Attributable';
    verdictDetail = 'The click ID reaches the page, the tag stores it and the form captures it.';
  }

  return {
    checks,
    summary: {
      pass: counts.pass,
      warn: counts.warn,
      fail: counts.fail,
      info: counts.info,
      total: checks.length,
      verdict,
      verdictDetail
    }
  };
}

/* ------------------------------------------------------------------ */
/* Markdown report (used by the Copy report button and by the tests)   */
/* ------------------------------------------------------------------ */

const STATUS_LABEL = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', info: 'INFO' };

export function buildMarkdownReport(snapshot, result) {
  const analysis = result || analyse(snapshot);
  const lines = [];

  lines.push('# Click ID check');
  lines.push('');
  lines.push(`- URL: ${snapshot.url || 'unknown'}`);
  lines.push(`- Page title: ${snapshot.title || 'unknown'}`);
  lines.push(`- Verdict: ${analysis.summary.verdict}`);
  lines.push(`- Result: ${analysis.summary.fail} fail, ${analysis.summary.warn} warn, ${analysis.summary.pass} pass, ${analysis.summary.info} info`);
  lines.push('');

  const tags = snapshot.tags || {};
  const detected = [];
  if (tags.googleTag) detected.push(`Google tag${tags.googleTagIds && tags.googleTagIds.length ? ` (${tags.googleTagIds.join(', ')})` : ''}`);
  if (tags.gtm) detected.push(`GTM${tags.gtmIds && tags.gtmIds.length ? ` (${tags.gtmIds.join(', ')})` : ''}`);
  if (tags.adsConversionIds && tags.adsConversionIds.length) detected.push(`Google Ads (${tags.adsConversionIds.join(', ')})`);
  if (tags.uet) detected.push(`Microsoft UET${tags.uetIds && tags.uetIds.length ? ` (${tags.uetIds.join(', ')})` : ''}`);
  if (tags.metaPixel) detected.push('Meta pixel');
  if (tags.clarity) detected.push('Microsoft Clarity');
  if (tags.sgtm) detected.push(`Server side container (${tags.sgtmEndpoints.join(', ')})`);
  if (tags.cmps && tags.cmps.length) detected.push(`Consent banner: ${tags.cmps.join(', ')}`);
  lines.push(`- Detected: ${detected.length ? detected.join('; ') : 'nothing recognised'}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');

  analysis.checks.forEach((c) => {
    lines.push(`### ${STATUS_LABEL[c.status]} - ${c.title}`);
    lines.push('');
    lines.push(c.detail);
    if (c.fix) {
      lines.push('');
      lines.push(`**Fix:** ${c.fix}`);
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('');
  lines.push('Produced by Fire Pixel Click ID Checker. No page data left the browser.');
  lines.push('https://firepixel.co.uk/tools/google-ads-signal-plan');
  lines.push('');

  return lines.join('\n');
}

export const _internals = {
  CLICK_ID_FIELD_RE,
  CONTEXT_FIELD_RE,
  clickIdsInUrl,
  adClickIdsInUrl,
  googleTagDetected,
  stripQuery
};
