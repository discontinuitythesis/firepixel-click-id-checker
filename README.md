# Fire Pixel Click ID Checker

A Chrome extension (Manifest V3) that answers one question about the page you are
looking at: **will a lead from this page be attributable back to the ad click?**

Open the popup on a landing page, ideally one you reached from an ad or one carrying a
test click ID, and you get a pass, warn or fail report covering the click ID in the URL,
the first party cookie the tag should have written, the Consent Mode state that usually
explains a missing cookie, the hidden fields on the forms, the redirect chain, the
Microsoft UET tag and telephone leads.

Built by Ben Luong for Fire Pixel (firepixel.co.uk), trading as CopperChunk Limited.

- Store name: Click ID Checker for Google & Microsoft Ads
- Version: 1.0.0
- Permissions: `activeTab` and `scripting`. Nothing else.
- Nothing leaves the browser. No storage, no background worker, no network calls.

---

## What it checks

| # | Check | What it means |
|---|-------|---------------|
| 1 | Click ID in the URL | Looks for `gclid`, `gbraid`, `wbraid`, `msclkid`, `dclid`, `fbclid` and `ttclid`. Fails when none is present and no click ID cookie exists either. Warns when a cookie exists but the URL carries nothing, because that combination only works if your form script reads the cookie. |
| 2 | Click ID stored in a first party cookie | `gclid` should produce `_gcl_aw`, `gbraid` and `wbraid` should produce `_gcl_gb`, `dclid` should produce `_gcl_dc`, `msclkid` should produce `_uetmsclkid`, `fbclid` should produce `_fbc`. A click ID with the matching tag present but no cookie is the single most common cause of unattributable leads, so it fails. No tag at all only warns. |
| 3 | Consent Mode | Reads `gtag('consent', 'default'\|'update', {...})` commands out of the dataLayer and reports `ad_storage`, `ad_user_data`, `ad_personalization` and `analytics_storage`. A denied default with nothing granting it, while a click ID is on the URL, fails and explains the missing cookie. A consent banner with no Consent Mode commands warns. A missing `ad_user_data` or `ad_personalization` raises the Consent Mode v2 warning. |
| 4 | Form capture | For every form: does it have a hidden field for the click ID, and is that field populated when the URL carries one? A form that collects an email address and captures no click ID fails. A hidden field that exists but sits empty warns, because the copying script has not run or ran before the field existed. The fix text is tailored to the detected builder: Contact Form 7, Gravity Forms, WPForms, Ninja Forms, HubSpot, Elementor, Fluent Forms, Formidable Forms, Mailchimp for WordPress, and Typeform, Tally, Jotform, Calendly or Google Forms in an iframe. |
| 5 | Redirects | Uses the Navigation Timing API. A redirect chain with no click ID on the final URL warns, because click IDs are routinely dropped at a hop. |
| 6 | Microsoft Ads | `msclkid` with no UET tag fails. A UET tag on a Google click is reported as information, since Microsoft auto-tagging only appends `msclkid` to Microsoft clicks. |
| 7 | Telephone leads | Telephone links with no call tracking signs warn, because a call carries no click ID. |
| 8 | Indexing | A paid landing page with a lead form, a self referencing canonical and no `noindex` warns, since organic traffic on a paid landing page muddles the reporting. |
| 9 | Verdict | A count of pass, warn, fail and info, plus one of three verdicts: Attributable, Attributable with gaps, or Not attributable as-is. |

The popup also lists what it detected on the page: Google tag and measurement id, GTM
containers, Google Ads conversion ids, UET, Meta pixel, TikTok pixel, LinkedIn Insight,
Clarity, first party server side container endpoints and the consent banner vendor.

The **Copy report** button puts a Markdown version of the whole report on the clipboard,
which is what you paste into a ticket or an email to a developer.

The **Reload with a test click ID** button appends `gclid=FIREPIXEL_TEST_<timestamp>` and
`msclkid=FIREPIXELTEST` to the current URL so you can test a landing page without
spending money on a click. It is hidden when the URL already carries a click ID. If
Chrome refuses the navigation, the popup shows you the URL to paste instead.

---

## Install the unpacked extension

1. Open `chrome://extensions` in Chrome or any Chromium browser.
2. Switch on **Developer mode**, top right.
3. Click **Load unpacked** and choose this folder (the one holding `manifest.json`).
4. Pin the extension to the toolbar so the icon is always visible.

Minimum Chrome version: 116.

There is no build step. The extension ships as plain ES modules, unminified, which is
also what the Chrome Web Store review process prefers.

---

## Test it with the demo landing page

`test/fixtures/landing-page.html` is a deliberately broken landing page. It has a Google
tag with an `AW-` conversion id, a Consent Mode v2 default of denied that nothing ever
grants, a Contact Form 7 style form with a hidden `gclid` field that nothing populates, a
second form that collects an email address and captures nothing at all, and a telephone
number with no call tracking.

Serve it over HTTP rather than opening it from disk, because `file://` pages cannot set
cookies:

```bash
cd test/fixtures
python3 -m http.server 8123
```

Then open `http://127.0.0.1:8123/landing-page.html?gclid=TEST` and click the extension
icon. You should see:

- Verdict: **Not attributable as-is**, 3 fail, 3 warn, 1 pass, 2 info
- Click ID found in the URL (info)
- `gclid` was not written to `_gcl_aw` (fail)
- Consent Mode denies `ad_storage` and nothing has granted it (fail)
- Consent Mode v2 signals present (pass)
- `#contact-form` (Contact Form 7) has an empty click ID field (warn)
- `#newsletter-form` collects an email address but captures no click ID (fail)
- 1 telephone link with no call tracking detected (warn)
- Paid landing page appears indexable (warn)

Open the same page without `?gclid=TEST` and the first check fails instead: no click ID
on this URL.

---

## Permissions rationale

| Permission | Why |
|------------|-----|
| `activeTab` | Grants temporary access to the tab you are on, and only at the moment you click the extension icon. It expires when you navigate away. It is what lets the extension read the URL, the cookies and the markup of the page you asked it to check. |
| `scripting` | Required to call `chrome.scripting.executeScript`, which is how the snapshot function runs inside the page. Without `activeTab` it grants nothing on its own. |

Deliberately **not** requested:

- No `host_permissions` and no `<all_urls>`. The extension can never read a page you have
  not explicitly asked it to check.
- No `tabs`. The extension cannot enumerate your tabs or read their URLs.
- No `cookies`. Cookies are read from inside the page with `document.cookie`, which only
  ever exposes the first party cookies of the page you are checking, and only while the
  popup is open.
- No `webRequest` or `declarativeNetRequest`. The extension does not see or modify
  network traffic.
- No `storage`. There is nothing to store.

`chrome.tabs.update` is used once, for the "Reload with a test click ID" button.
`activeTab` covers that call for the current tab, so the `tabs` permission is not needed.

---

## Privacy

The extension collects nothing, transmits nothing and stores nothing.

The snapshot taken from the page never leaves the popup. It exists in memory while the
popup is open and is discarded when the popup closes. There is no background service
worker, no analytics, no error reporting, no remote configuration and no network request
of any kind in the extension code. `tools/verify.mjs` asserts that the shipped source
contains no `fetch`, no `XMLHttpRequest`, no `sendBeacon`, no `chrome.storage`, no `eval`
and no remotely hosted script.

Cookie values shown in the popup are truncated to twelve characters, purely so the report
stays readable. The full Markdown report goes to your clipboard only when you press
**Copy report**.

See `PRIVACY-POLICY.md` for the text published at
https://firepixel.co.uk/extension-privacy.

---

## Development

```bash
npm test          # node --test test/*.test.js  (30 unit tests plus 1 browser test)
npm run verify    # manifest, permissions, icons, module loading, forbidden patterns
npm run assets    # regenerate icons and store artwork with Pillow
npm run lint:syntax
npm run zip       # dist/firepixel-click-id-checker-1.0.0.zip
```

There are no runtime dependencies. Playwright is optional and only used by the browser
test, which skips itself when Playwright is not installed:

```bash
npm i -D playwright
node --test test/browser.test.js
```

or against an existing install:

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.js \
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
node --test test/browser.test.js
```

The browser test serves the demo landing page over HTTP, runs `collectSnapshot` inside a
real Chromium page exactly as `chrome.scripting.executeScript` would, and asserts on both
the raw snapshot and the analysis.

### Layout

```
manifest.json            MV3 manifest, activeTab and scripting only
src/snapshot.js          collectSnapshot(), injected into the page, self contained
src/analyse.js           analyse() and buildMarkdownReport(), pure, no DOM
popup/popup.html         popup markup
popup/popup.css          popup styles
popup/popup.js           popup controller, ES module
icons/                   16, 32, 48 and 128 pixel PNGs
store/                   promo tile, the five store screenshots, a real popup render
test/analyse.test.js     30 unit tests over the rules
test/browser.test.js     end to end snapshot test in Chromium, skips without Playwright
test/fixtures/           the demo landing page
tools/make-assets.py     regenerates icons and store artwork
tools/verify.mjs         pre-submission checks
```

`src/snapshot.js` is the only file with a hard constraint on how it is written. Chrome
serialises `collectSnapshot` to source text before injecting it, so the function must not
reference anything outside itself: no imports, no module level helpers, no closures.

---

## Release checklist

1. `npm test` and `npm run verify` both clean.
2. Bump `version` in `manifest.json` and `package.json`, and update the filename in the
   `zip` script.
3. `npm run zip` produces `dist/firepixel-click-id-checker-1.0.0.zip` containing only
   `manifest.json`, `src/`, `popup/` and `icons/`. Nothing else ships: no tests, no
   fixtures, no tools, no store artwork, no documentation.
4. The five store screenshots are `store/screenshot-1.png` to `store/screenshot-5.png`,
   1280x800, taken on the demo landing page. If you retake them, use the demo landing page
   or a site you own. Do not put a client site, a real account number or anyone's personal
   data in the frame. `store/popup-render.png` is a genuine capture of the popup on the
   demo page.
5. Chrome Web Store developer dashboard, one time setup:
   - Pay the one off five dollar registration fee from a dedicated Fire Pixel email
     address. That address is permanent.
   - Verify firepixel.co.uk as a publisher domain so the listing carries the verified
     publisher mark.
   - **DSA trader declaration.** CopperChunk Limited sells services, so declare trader
     status, not non-trader. A trader must publish a physical address and a telephone
     number, and those details are shown publicly on the listing. Use the CopperChunk
     Limited registered address. Getting this wrong, or skipping it, blocks distribution
     in the European Union.
6. New item, upload the zip, then fill the listing from `STORE-LISTING.md`: name, short
   description, full description, category, language (English UK), screenshots, the
   440x280 promo tile, the single purpose statement and the permission justifications.
7. Privacy tab: publish `PRIVACY-POLICY.md` at
   https://firepixel.co.uk/extension-privacy first, then paste that URL in. Answer the
   data usage questions as set out in `STORE-LISTING.md` and tick all three certification
   boxes.
8. Submit for review. An `activeTab` only extension with no host permissions is the
   fastest category to review, typically days rather than weeks. A brand new developer
   account adds time to the first submission.
9. After approval: publish the companion article, "How to check your Google Ads click IDs
   are being captured", link it from the listing, and ask ten clients or peers to install
   and rate in the first week. Install count and rating count are the two ranking levers
   you control after the name and the short description.
