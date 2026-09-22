/*
 * Fire Pixel Click ID Checker - page snapshot collector.
 *
 * collectSnapshot() is injected into the active tab by chrome.scripting.executeScript
 * as the `func` argument. Chrome serialises the function to source text, so it MUST be
 * completely self contained: no references to module scope, no imports, no closures.
 *
 * It reads only from the page it is injected into and returns a plain object.
 * Nothing is stored and nothing is sent anywhere.
 */

export function collectSnapshot() {
  /* ---------- small helpers (all local, the function must be self contained) ---------- */

  var MAX = 12;

  function trunc(value) {
    if (value === null || value === undefined) return '';
    var s = String(value);
    if (s.length <= MAX) return s;
    return s.slice(0, MAX) + '…';
  }

  function uniq(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && out.indexOf(list[i]) === -1) out.push(list[i]);
    }
    return out;
  }

  function matchAll(text, re) {
    var out = [];
    if (!text) return out;
    var m;
    var rx = new RegExp(re.source, re.flags.indexOf('g') === -1 ? re.flags + 'g' : re.flags);
    while ((m = rx.exec(text)) !== null) {
      out.push(m[1] === undefined ? m[0] : m[1]);
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
    return out;
  }

  function safe(fn, fallback) {
    try {
      var v = fn();
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  /* ---------- URL and query parameters ---------- */

  var href = safe(function () { return location.href; }, '');
  var search = safe(function () { return location.search; }, '');
  var hostname = safe(function () { return location.hostname; }, '');

  var PARAM_NAMES = [
    'gclid', 'gbraid', 'wbraid', 'dclid', 'msclkid', 'fbclid', 'ttclid', 'li_fat_id',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'
  ];

  var params = {};
  var query = safe(function () { return new URLSearchParams(search); }, null);
  for (var p = 0; p < PARAM_NAMES.length; p++) {
    var name = PARAM_NAMES[p];
    var raw = query ? query.get(name) : null;
    params[name] = {
      present: raw !== null && raw !== '',
      value: trunc(raw),
      length: raw ? String(raw).length : 0
    };
  }

  /* ---------- first party cookies ---------- */

  var COOKIE_NAMES = [
    '_gcl_aw', '_gcl_gb', '_gcl_gs', '_gcl_dc', '_gcl_au', '_gcl_ag',
    '_uetmsclkid', '_uetsid', '_uetvid',
    '_fbc', '_fbp', '_ttp', '_ga'
  ];

  var rawCookie = safe(function () { return document.cookie; }, '');
  var cookieMap = {};
  var cookieNamesOnPage = [];
  if (rawCookie) {
    var parts = rawCookie.split(';');
    for (var c = 0; c < parts.length; c++) {
      var piece = parts[c];
      var eq = piece.indexOf('=');
      if (eq === -1) continue;
      var cname = piece.slice(0, eq).trim();
      var cvalue = piece.slice(eq + 1).trim();
      if (!cname) continue;
      cookieMap[cname] = cvalue;
      cookieNamesOnPage.push(cname);
    }
  }

  var cookies = {};
  for (var k = 0; k < COOKIE_NAMES.length; k++) {
    var cn = COOKIE_NAMES[k];
    var has = Object.prototype.hasOwnProperty.call(cookieMap, cn) && cookieMap[cn] !== '';
    cookies[cn] = { present: has, value: has ? trunc(cookieMap[cn]) : '' };
  }

  var gclPrefixed = [];
  var gaPrefixed = [];
  for (var n = 0; n < cookieNamesOnPage.length; n++) {
    var nm = cookieNamesOnPage[n];
    if (nm.indexOf('_gcl_') === 0) gclPrefixed.push(nm);
    if (nm.indexOf('_ga_') === 0) gaPrefixed.push(nm);
  }

  /* ---------- scripts, tags and CMPs ---------- */

  var scriptEls = safe(function () {
    return Array.prototype.slice.call(document.querySelectorAll('script'));
  }, []);

  var srcs = [];
  var inlineText = '';
  for (var s = 0; s < scriptEls.length; s++) {
    var el = scriptEls[s];
    var src = el.getAttribute('src');
    if (src) {
      srcs.push(src);
    } else if (el.textContent && el.textContent.length < 400000) {
      inlineText += '\n' + el.textContent;
    }
  }
  var srcBlob = srcs.join('\n');
  var allScriptText = srcBlob + '\n' + inlineText;

  var dataLayerRaw = safe(function () {
    return Array.isArray(window.dataLayer) ? window.dataLayer : null;
  }, null);

  var dataLayerText = '';
  if (dataLayerRaw) {
    dataLayerText = safe(function () {
      var seen = [];
      return JSON.stringify(dataLayerRaw, function (key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.indexOf(value) !== -1) return '[circular]';
          seen.push(value);
        }
        if (typeof value === 'function') return '[function]';
        return value;
      });
    }, '');
  }

  var googleTagIds = uniq(
    matchAll(srcBlob, /googletagmanager\.com\/gtag\/js\?[^"'\s]*id=([A-Za-z0-9_-]+)/i)
  );
  var gtmIds = uniq(
    matchAll(allScriptText, /\bGTM-[A-Z0-9]{4,}\b/i).concat(matchAll(dataLayerText, /\bGTM-[A-Z0-9]{4,}\b/i))
  );
  var adsConversionIds = uniq(
    matchAll(allScriptText, /\bAW-\d{6,}\b/i).concat(matchAll(dataLayerText, /\bAW-\d{6,}\b/i))
  );
  var ga4Ids = uniq(matchAll(allScriptText, /\bG-[A-Z0-9]{6,}\b/i));

  var hasGoogleTagScript = /googletagmanager\.com\/gtag\/js/i.test(srcBlob);
  var hasGtmScript = /googletagmanager\.com\/(gtm|gtag)\.js/i.test(srcBlob) || gtmIds.length > 0;
  var hasGtagFn = safe(function () { return typeof window.gtag === 'function'; }, false);

  var uetPresent = /bat\.bing\.com\/(bat|action)\.js/i.test(srcBlob) ||
    safe(function () { return !!window.uetq; }, false) ||
    /window\.uetq/i.test(inlineText);
  var uetIds = uniq(matchAll(inlineText, /["']?ti["']?\s*:\s*["']?(\d{6,})["']?/i));

  var metaPixel = /connect\.facebook\.net/i.test(srcBlob) || /\bfbq\s*\(/.test(inlineText);
  var metaPixelIds = uniq(matchAll(inlineText, /fbq\s*\(\s*["']init["']\s*,\s*["'](\d{6,})["']/i));

  var clarity = /clarity\.ms/i.test(allScriptText);
  var tiktokPixel = /analytics\.tiktok\.com/i.test(srcBlob) || /\bttq\./.test(inlineText);
  var linkedinInsight = /snap\.licdn\.com/i.test(srcBlob) || /_linkedin_partner_id/i.test(inlineText);

  /* server side GTM: a gtm.js or gtag/js script served from the page's own host */
  var sgtmEndpoints = [];
  for (var q = 0; q < srcs.length; q++) {
    var candidate = srcs[q];
    var resolved = safe(function () { return new URL(candidate, href); }, null);
    if (!resolved) continue;
    if (!/\/(gtm\.js|gtag\/js)/i.test(resolved.pathname)) continue;
    if (/googletagmanager\.com$/i.test(resolved.hostname)) continue;
    sgtmEndpoints.push(resolved.hostname + resolved.pathname);
  }
  sgtmEndpoints = uniq(sgtmEndpoints);

  var CMP_HINTS = [
    { id: 'cookiepal', label: 'CookiePal', re: /cookiepal/i, global: 'CookiePal' },
    { id: 'cookieyes', label: 'CookieYes', re: /cookieyes|cky-/i, global: 'cookieyes' },
    { id: 'cookiebot', label: 'Cookiebot', re: /cookiebot|consent\.cookiebot/i, global: 'Cookiebot' },
    { id: 'onetrust', label: 'OneTrust', re: /onetrust|optanon|cookielaw\.org/i, global: 'OneTrust' },
    { id: 'usercentrics', label: 'Usercentrics', re: /usercentrics/i, global: 'UC_UI' },
    { id: 'didomi', label: 'Didomi', re: /didomi/i, global: 'Didomi' },
    { id: 'complianz', label: 'Complianz', re: /complianz|cmplz/i, global: 'cmplz_' },
    { id: 'iubenda', label: 'Iubenda', re: /iubenda/i, global: '_iub' },
    { id: 'termly', label: 'Termly', re: /termly/i, global: 'Termly' },
    { id: 'klaro', label: 'Klaro', re: /klaro/i, global: 'klaro' }
  ];

  var cmps = [];
  for (var h = 0; h < CMP_HINTS.length; h++) {
    var hint = CMP_HINTS[h];
    var inScripts = hint.re.test(allScriptText);
    var asGlobal = safe(function () {
      return typeof window[hint.global] !== 'undefined';
    }, false);
    if (inScripts || asGlobal) cmps.push(hint.label);
  }
  var tcfPresent = safe(function () { return typeof window.__tcfapi === 'function'; }, false);
  if (tcfPresent && cmps.indexOf('IAB TCF CMP') === -1) cmps.push('IAB TCF CMP');
  cmps = uniq(cmps);

  /* ---------- Consent Mode ---------- */

  var CONSENT_KEYS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];
  var consentEntries = [];

  if (dataLayerRaw) {
    for (var d = 0; d < dataLayerRaw.length; d++) {
      var entry = dataLayerRaw[d];
      if (!entry || typeof entry !== 'object') continue;
      /* gtag() pushes an `arguments` object: { 0: 'consent', 1: 'default'|'update', 2: {...} } */
      var first = entry[0];
      var second = entry[1];
      var payload = entry[2];
      if (String(first).toLowerCase() !== 'consent') continue;
      var mode = String(second || '').toLowerCase();
      if (mode !== 'default' && mode !== 'update') continue;
      var record = { mode: mode, index: d, region: null, wait_for_update: null };
      for (var ck = 0; ck < CONSENT_KEYS.length; ck++) {
        var key = CONSENT_KEYS[ck];
        record[key] = (payload && typeof payload === 'object' && payload[key] !== undefined)
          ? String(payload[key])
          : null;
      }
      if (payload && typeof payload === 'object') {
        if (payload.region !== undefined) {
          record.region = safe(function () { return [].concat(payload.region).join(', '); }, null);
        }
        if (payload.wait_for_update !== undefined) {
          record.wait_for_update = Number(payload.wait_for_update);
        }
      }
      consentEntries.push(record);
    }
  }

  var hasDefault = false;
  var hasUpdate = false;
  for (var ce = 0; ce < consentEntries.length; ce++) {
    if (consentEntries[ce].mode === 'default') hasDefault = true;
    if (consentEntries[ce].mode === 'update') hasUpdate = true;
  }

  /* ---------- forms ---------- */

  var HIDDEN_FIELD_RE = /gclid|gbraid|wbraid|msclkid|fbclid|ttclid|dclid|utm_|click.?id|referr|landing|source/i;

  var FORM_BUILDERS = [
    { id: 'cf7', label: 'Contact Form 7', re: /wpcf7/i },
    { id: 'gravity', label: 'Gravity Forms', re: /\bgform|gravity[_-]?form/i },
    { id: 'wpforms', label: 'WPForms', re: /wpforms/i },
    { id: 'ninja', label: 'Ninja Forms', re: /\bnf-form|ninja[_-]?forms/i },
    { id: 'hubspot', label: 'HubSpot', re: /hsforms|hs-form|hbspt/i },
    { id: 'elementor', label: 'Elementor Forms', re: /elementor-form/i },
    { id: 'mailchimp', label: 'Mailchimp', re: /mc4wp|mc-embedded/i },
    { id: 'fluent', label: 'Fluent Forms', re: /fluentform|ff-el-/i },
    { id: 'formidable', label: 'Formidable Forms', re: /frm_form|formidable/i }
  ];

  function isVisible(node) {
    return safe(function () {
      if (!node) return false;
      if (node.type === 'hidden') return false;
      var rects = node.getClientRects();
      return rects && rects.length > 0;
    }, false);
  }

  var formEls = safe(function () {
    return Array.prototype.slice.call(document.querySelectorAll('form'));
  }, []);

  var forms = [];
  for (var f = 0; f < formEls.length; f++) {
    var form = formEls[f];
    var fields = safe(function () {
      return Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'));
    }, []);

    var visibleInputs = 0;
    var hasEmailField = false;
    var hiddenFields = [];
    var hiddenTotal = 0;

    for (var fi = 0; fi < fields.length; fi++) {
      var field = fields[fi];
      var type = (field.getAttribute('type') || field.type || '').toLowerCase();
      var fname = field.getAttribute('name') || '';
      var fid = field.getAttribute('id') || '';
      var placeholder = field.getAttribute('placeholder') || '';

      if (type === 'hidden') {
        hiddenTotal++;
        var label = fname || fid;
        if (HIDDEN_FIELD_RE.test(label)) {
          var val = field.value === undefined || field.value === null ? '' : String(field.value);
          hiddenFields.push({
            name: fname,
            id: fid,
            filled: val.trim() !== '',
            value: trunc(val)
          });
        }
        continue;
      }

      if (isVisible(field)) visibleInputs++;
      if (type === 'email' || /e-?mail/i.test(fname + ' ' + fid + ' ' + placeholder)) {
        hasEmailField = true;
      }
    }

    var formMarkup = safe(function () {
      return (form.className || '') + ' ' + (form.id || '') + ' ' +
        (form.getAttribute('data-wpcf7-id') ? 'wpcf7' : '') + ' ' +
        (form.parentElement ? (form.parentElement.className || '') : '');
    }, '');

    var builders = [];
    for (var b = 0; b < FORM_BUILDERS.length; b++) {
      if (FORM_BUILDERS[b].re.test(formMarkup)) builders.push(FORM_BUILDERS[b].id);
    }

    forms.push({
      index: f,
      id: safe(function () { return form.id || ''; }, ''),
      name: safe(function () { return form.getAttribute('name') || ''; }, ''),
      action: safe(function () { return form.getAttribute('action') || ''; }, ''),
      method: safe(function () { return (form.getAttribute('method') || 'get').toLowerCase(); }, 'get'),
      visibleInputs: visibleInputs,
      hiddenInputCount: hiddenTotal,
      hasEmailField: hasEmailField,
      hiddenFields: hiddenFields,
      builders: builders
    });
  }

  /* embedded form iframes (Typeform, Tally, HubSpot meetings and similar) */
  var IFRAME_FORMS = [
    { id: 'typeform', label: 'Typeform', re: /typeform\.com/i },
    { id: 'tally', label: 'Tally', re: /tally\.so/i },
    { id: 'hubspot', label: 'HubSpot', re: /hsforms\.(net|com)|meetings\.hubspot/i },
    { id: 'jotform', label: 'Jotform', re: /jotform/i },
    { id: 'calendly', label: 'Calendly', re: /calendly\.com/i },
    { id: 'gforms', label: 'Google Forms', re: /docs\.google\.com\/forms/i }
  ];

  var iframeForms = [];
  var iframeEls = safe(function () {
    return Array.prototype.slice.call(document.querySelectorAll('iframe'));
  }, []);
  for (var ifr = 0; ifr < iframeEls.length; ifr++) {
    var isrc = iframeEls[ifr].getAttribute('src') || iframeEls[ifr].getAttribute('data-src') || '';
    if (!isrc) continue;
    for (var ib = 0; ib < IFRAME_FORMS.length; ib++) {
      if (IFRAME_FORMS[ib].re.test(isrc)) {
        iframeForms.push({
          id: IFRAME_FORMS[ib].id,
          label: IFRAME_FORMS[ib].label,
          hasQueryString: isrc.indexOf('?') !== -1,
          src: isrc.slice(0, 120)
        });
      }
    }
  }

  /* HubSpot embedded forms are often divs, not <form> tags, until the script runs */
  var hubspotEmbed = safe(function () {
    return document.querySelectorAll('.hbspt-form, [data-hs-forms-root], .hs-form').length > 0;
  }, false);

  /* ---------- navigation ---------- */

  var navEntry = safe(function () {
    var entries = performance.getEntriesByType('navigation');
    return entries && entries.length ? entries[0] : null;
  }, null);

  var navigation = {
    redirectCount: navEntry && typeof navEntry.redirectCount === 'number' ? navEntry.redirectCount : 0,
    type: navEntry && navEntry.type ? String(navEntry.type) : 'unknown',
    available: !!navEntry,
    historyLength: safe(function () { return history.length; }, 0)
  };

  /* ---------- page meta and call tracking ---------- */

  var canonical = safe(function () {
    var link = document.querySelector('link[rel="canonical"]');
    return link ? link.href : '';
  }, '');

  var robots = safe(function () {
    var meta = document.querySelector('meta[name="robots"]');
    return meta ? (meta.getAttribute('content') || '') : '';
  }, '');

  var telAnchors = safe(function () {
    return Array.prototype.slice.call(document.querySelectorAll('a[href^="tel:"]'));
  }, []);

  var CALL_HINT_RE = /calltrk|callrail|\bdni\b|call-?tracking|swap-?number|phonewrapper|infinity[-_]?tracking|ruler-?analytics|whatconverts|mediahawk/i;
  var callTrackingHints = [];
  for (var t = 0; t < telAnchors.length; t++) {
    var a = telAnchors[t];
    var attrBlob = safe(function () {
      var bits = [a.className || '', a.id || ''];
      for (var ai = 0; ai < a.attributes.length; ai++) {
        bits.push(a.attributes[ai].name + '=' + a.attributes[ai].value);
      }
      return bits.join(' ');
    }, '');
    if (CALL_HINT_RE.test(attrBlob)) callTrackingHints.push('tel link attribute');
  }
  if (CALL_HINT_RE.test(allScriptText)) callTrackingHints.push('call tracking script');
  callTrackingHints = uniq(callTrackingHints);

  /* ---------- result ---------- */

  return {
    schema: 1,
    url: href,
    hostname: hostname,
    referrer: safe(function () { return document.referrer || ''; }, ''),
    title: safe(function () { return document.title || ''; }, ''),
    params: params,
    cookies: cookies,
    gclPrefixedCookies: gclPrefixed,
    gaPrefixedCookies: gaPrefixed,
    tags: {
      googleTag: hasGoogleTagScript || hasGtagFn,
      googleTagIds: googleTagIds,
      gtm: hasGtmScript,
      gtmIds: gtmIds,
      adsConversionIds: adsConversionIds,
      ga4Ids: ga4Ids,
      uet: uetPresent,
      uetIds: uetIds,
      metaPixel: metaPixel,
      metaPixelIds: metaPixelIds,
      clarity: clarity,
      tiktokPixel: tiktokPixel,
      linkedinInsight: linkedinInsight,
      sgtm: sgtmEndpoints.length > 0,
      sgtmEndpoints: sgtmEndpoints,
      cmps: cmps
    },
    consent: {
      dataLayerPresent: !!dataLayerRaw,
      dataLayerLength: dataLayerRaw ? dataLayerRaw.length : 0,
      entries: consentEntries,
      hasDefault: hasDefault,
      hasUpdate: hasUpdate
    },
    forms: forms,
    iframeForms: iframeForms,
    hubspotEmbed: hubspotEmbed,
    navigation: navigation,
    meta: {
      canonical: canonical,
      robots: robots,
      telLinkCount: telAnchors.length,
      callTrackingHints: callTrackingHints
    }
  };
}
