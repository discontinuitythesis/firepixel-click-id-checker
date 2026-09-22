# Privacy policy: Click ID Checker for Google & Microsoft Ads

**Page to publish at:** https://firepixel.co.uk/extension-privacy
**Effective date:** 22 September 2026
**Applies to:** the Chrome extension "Click ID Checker for Google & Microsoft Ads",
version 1.0.0 and later, published by CopperChunk Limited trading as Fire Pixel.

---

## The short version

The extension collects nothing, transmits nothing and stores nothing.

Everything it reads from a web page is read in your browser, analysed in your browser and
discarded when you close the popup. No data reaches Fire Pixel, CopperChunk Limited or any
other party. There is no account, no sign in, no analytics and no error reporting.

---

## What the extension does

When you click the extension icon on a web page, the extension runs one function inside
that page and reads:

- the page URL, its query parameters and the referrer
- the page title
- the page's own first party cookies, through `document.cookie`
- the `src` attributes and inline contents of the page's script tags, to recognise
  tracking tags and consent banners
- the `window.dataLayer` array, specifically the Consent Mode commands in it
- the page's forms, their hidden fields and whether those fields hold a value
- navigation timing information, such as how many redirects the browser followed
- the canonical link, the robots meta tag and any telephone links

It returns that information to the extension popup, which analyses it and shows you a
report. That is the whole operation.

## What happens to that information

It exists in the memory of the popup window and nowhere else. When the popup closes, it is
gone. The extension:

- does not write it to `chrome.storage`, `localStorage`, `sessionStorage`, IndexedDB, a
  cookie or a file
- does not send it anywhere, by any means. There is no `fetch`, no `XMLHttpRequest`, no
  `sendBeacon`, no image beacon and no WebSocket anywhere in the extension code
- does not have a background service worker, so nothing runs when the popup is closed
- does not include analytics, crash reporting, advertising or any third party library

Cookie and click ID values shown in the popup are truncated to twelve characters, so the
report stays readable.

If you press **Copy report**, a Markdown version of the report is written to your system
clipboard using the browser's clipboard API. That is an action you take deliberately, the
content goes only to your clipboard, and nothing is sent over a network.

## Permissions

The extension requests two permissions and no host permissions.

**activeTab.** This grants temporary access to the single tab you are on, and only from
the moment you click the extension icon. The access ends when you navigate that tab
elsewhere or close it. It cannot be used to read any other tab, and it cannot be used on
the current tab until you ask for a scan.

**scripting.** This allows `chrome.scripting.executeScript`, which is how the reading
function above runs inside the page. On its own it grants access to nothing. Combined with
`activeTab`, it applies only to the tab you invoked the extension on.

The extension deliberately does **not** request:

- any host permission, including `<all_urls>`. It therefore has no standing access to any
  website and cannot read pages in the background.
- the `tabs` permission. It cannot list your tabs or read their URLs or titles.
- the `cookies` permission. It never uses the browser cookie store. It only sees the first
  party cookies of the page you asked it to check, through that page's own
  `document.cookie`.
- `webRequest` or `declarativeNetRequest`. It cannot observe or modify network traffic.
- `storage`. It has nowhere to persist anything.

The **Reload with a test click ID** button navigates the current tab to the same URL with
test parameters appended. `activeTab` permits this for the tab you invoked the extension
on. No other tab can be navigated.

## Pages the extension cannot read

Chrome does not allow extensions to run on browser pages such as `chrome://` URLs, the
Chrome Web Store, other extensions' pages or the built in PDF viewer. On those pages the
extension shows a message and reads nothing.

## Remote code

The extension contains no remotely hosted code. All of its logic ships inside the package
as readable, unminified ES modules. There is no `eval`, no `new Function` and no remote
configuration. Nothing about the extension's behaviour can be changed without publishing a
new version through the Chrome Web Store review process.

## Children

The extension is a professional tool for advertisers. It is not directed at children and
it collects no data from anyone.

## Legal basis and your rights

Because no personal data is collected, processed or stored by CopperChunk Limited through
this extension, there is no personal data for us to disclose, correct, export or erase in
response to a request under the UK GDPR, the EU GDPR or any comparable law. If you believe
otherwise, please contact us at the address below and we will investigate.

## Changes to this policy

If a future version of the extension changes what it reads or what it does with it, this
page will be updated and the effective date above will change before that version is
published. Material changes will also be noted in the Chrome Web Store listing.

## Contact

CopperChunk Limited, trading as Fire Pixel
Email: ben@firepixel.co.uk
Web: https://firepixel.co.uk

CopperChunk Limited is registered in England and Wales. The registered company number and
registered office address are published on the Chrome Web Store listing in line with the
EU Digital Services Act trader requirements.
