# Chrome Web Store listing copy

Everything below is ready to paste into the developer dashboard. British English
throughout. Plain statements, no hype, no superlatives, no claims that cannot be
demonstrated in the extension itself.

---

## Name

```
Click ID Checker for Google & Microsoft Ads
```

43 characters. The manifest `name` field is limited to 45 characters and the store takes
the item name from the manifest, so the longer working title "Click ID Checker for Google
Ads & Microsoft Ads" does not fit. The keywords that matter, "click ID", "Google" and
"Microsoft Ads", all survive the shortening. The extension name is the strongest single
ranking factor both in store search and for the listing page in Google search, so keep
the keyword first and resist adding "Fire Pixel" to the front of it.

---

## Short description (132 characters maximum)

```
Check that a landing page keeps the Google Ads or Microsoft Ads click ID, so leads can be matched back to the ad click.
```

118 characters. Identical to the `description` field in `manifest.json`.

---

## Full description

```
Click ID Checker answers one question about the page you are looking at: will a lead from this page be attributable back to the ad click?

Open the popup on a landing page, ideally one you reached from an ad, and you get a pass, warn or fail report in a few seconds. Every check comes with a plain English explanation and a specific fix.

WHAT IT CHECKS

1. Click ID in the URL. Looks for gclid, gbraid, wbraid, msclkid, dclid, fbclid and ttclid, and tells you if none of them is present.

2. The first party cookie. A gclid should produce a _gcl_aw cookie, gbraid and wbraid should produce _gcl_gb, msclkid should produce _uetmsclkid, and fbclid should produce _fbc. A click ID on the URL with the matching tag on the page but no cookie is the most common cause of leads that cannot be imported back into Google Ads, so the report says so directly.

3. Consent Mode. Reads the consent default and consent update commands out of the dataLayer and shows ad_storage, ad_user_data, ad_personalization and analytics_storage. A default of denied with nothing granting it usually explains the missing cookie, and the report links the two. Missing Consent Mode v2 signals are flagged separately.

4. Form capture. For every form on the page, the report says whether there is a hidden field for the click ID and whether it is actually populated. A form that collects an email address and captures no click ID is a failure, because those leads cannot be matched to a click. The advice is tailored to the form builder it detects: Contact Form 7, Gravity Forms, WPForms, Ninja Forms, HubSpot, Elementor, Fluent Forms, Formidable Forms, and Typeform, Tally, Jotform or Calendly embedded in an iframe.

5. Redirects. If the page was reached through a redirect and the click ID is gone, the report tells you how many hops there were and where to look.

6. Microsoft Ads. A msclkid with no UET tag on the page is a failure.

7. Telephone leads. Telephone links with no call tracking are flagged, because a call carries no click ID.

8. Indexing. A paid landing page that is open to organic traffic is flagged, because it muddles paid reporting.

TOOLS IN THE POPUP

Copy report puts the whole report on your clipboard as Markdown, ready to paste into a ticket or an email to a developer.

Reload with a test click ID appends a test gclid and msclkid to the current URL, so you can test a landing page without paying for a click.

The popup also lists what it found on the page: the Google tag and its measurement id, Google Tag Manager containers, Google Ads conversion ids, Microsoft UET, the Meta pixel, TikTok and LinkedIn tags, Microsoft Clarity, first party server side container endpoints, and which consent banner is in use.

WHO IT IS FOR

Google Ads managers, agencies, freelancers and in house marketers who need to know whether offline conversion import will work before they build it, and anyone debugging why Google Ads reports fewer conversions than the CRM.

PERMISSIONS AND PRIVACY

The extension asks for two permissions: activeTab and scripting. There are no host permissions, so it can never read a page you have not asked it to check. It does not use the tabs, cookies, webRequest or storage permissions.

Nothing is collected, nothing is transmitted and nothing is stored. The snapshot of the page exists in memory while the popup is open and is discarded when you close it. There is no analytics, no error reporting and no network request of any kind in the extension code. The source ships unminified so you can read all of it.

Built by Fire Pixel, a UK Google Ads consultancy. firepixel.co.uk
```

---

## Category

**Developer Tools.**

Reasoning: the tool reads a page's tags, cookies, dataLayer and form markup and reports an
implementation fault with a technical fix. That is the same job as Google Tag Assistant,
Analytics Debugger, Omnibug and the various dataLayer inspectors, all of which sit in
Developer Tools, so the extension appears next to its real competitive set and in front of
people already browsing for tag debugging tools. Productivity is the wrong shelf: it is
full of note takers, tab managers and writing aids, and a click ID checker placed there
would be judged against tools it has nothing in common with. The audience is marketers
rather than software engineers, but the store's Developer Tools category is where every
comparable extension lives and where the search intent sits.

Language: English (United Kingdom).

---

## Screenshots

Five screenshots at 1280x800. Captions, in order:

1. **One click gives a verdict: Attributable, Attributable with gaps, or Not attributable as-is.**
2. **The click ID reached the page but the Google tag never wrote _gcl_aw, and the report says why.**
3. **Consent Mode read straight from the dataLayer, including the Consent Mode v2 signals.**
4. **Every form on the page checked for a hidden click ID field, with advice for the form builder it detects.**
5. **Copy the whole report as Markdown and send it to whoever has to fix it.**

Promo tile: `store/promo-tile-440x280.png` (440x280, required for the small tile).

---

## Single purpose statement

As the dashboard asks for it, in one paragraph:

```
This extension has one purpose: to report whether the page in the active tab preserves the advertising click ID well enough for a lead from that page to be attributed back to the ad click. When the user clicks the extension icon, it reads the current page's URL parameters, first party cookies, tracking tag markup, dataLayer consent commands and form fields, and displays a pass, warn or fail report in the popup. It does nothing else.
```

---

## Permission justifications

The dashboard asks for a justification per permission. Paste these verbatim.

**activeTab**

```
The extension examines the page the user is currently on, and only when the user clicks the extension icon. activeTab grants temporary access to that one tab at that moment, which is exactly the scope required. It is used to read the page URL, and as the target for the single scripting call that collects the page snapshot. No host permissions are requested, so the extension has no access to any other page, and no access to the current page before the user asks for it.
```

**scripting**

```
The extension calls chrome.scripting.executeScript once per scan to run a single self contained function inside the active tab. That function reads the page URL and query parameters, document.cookie, the src and inline contents of script tags, window.dataLayer consent entries, form and hidden input fields, navigation timing and the canonical and robots tags, and returns them as a plain object to the popup, which analyses them locally. No code is injected persistently, no content script is registered in the manifest, no remotely hosted code is used, and the function does not modify the page.
```

**Remote code**

```
No, I am not using remote code.
```

All logic ships inside the package as unminified ES modules. There is no eval, no
`new Function`, no remotely hosted script and no remote configuration.

---

## Privacy practices form

**Does this item collect or use user data?** The store still requires the data usage
declarations even when the answer is no, so tick nothing in the data type grid and answer
as follows.

| Data type | Collected? |
|-----------|------------|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No |

Nothing is collected, because nothing leaves the user's browser. The page snapshot is
created in the popup's memory, analysed in the popup, and destroyed when the popup closes.
The extension has no background service worker, no storage permission, and makes no
network requests.

**Certification checkboxes.** Tick all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://firepixel.co.uk/extension-privacy
```

Publish `PRIVACY-POLICY.md` at that URL before submitting. The store rejects a listing
whose privacy policy URL returns a 404.

---

## Known review risks

Three things a reviewer could push back on. None is a policy breach, but know the answer
before you submit.

1. **Third party trademarks in the name.** "Google" and "Microsoft Ads" appear in the
   item name. This follows the accepted "[tool] for [platform]" convention rather than
   the prohibited form, which is leading with the brand as though the extension were an
   official product ("Google Ads Click ID Checker"). Do not add a Google or Microsoft
   logo, colour scheme or wordmark to the icon, the promo tile or the screenshots, and do
   not describe the extension as official, approved or partnered. The icon and promo tile
   supplied here are original artwork with no third party marks.
2. **Single purpose.** The listing describes eight checks, which can read as eight
   features. They are one purpose: deciding whether a lead from the current page is
   attributable to the ad click. The single purpose statement above states that in one
   sentence, and each check is framed in the extension itself as a reason the attribution
   would fail. Resist adding anything to this extension that is not part of that
   question. A Consent Mode verifier or a signal plan scanner ships as a separate item.
3. **A product mention inside the tool.** The Contact Form 7 fix text names the free Fire
   Pixel plugin that solves the problem. This is a link free mention of the publisher's
   own free plugin, in context, next to the generic alternative, so it is neither an
   affiliate link nor undisclosed promotion. If a reviewer objects, change the sentence to
   the generic advice and keep the plugin reference on the website.

Not a risk, but worth stating in the submission notes field: the extension makes no
network requests at all, so there is nothing for a reviewer to intercept and nothing to
disclose.

---

## Listing support fields

- Homepage URL: `https://firepixel.co.uk`
- Support URL: `https://firepixel.co.uk/contact`
- Support email: `ben@firepixel.co.uk`
- Publisher: verify `firepixel.co.uk` so the listing carries the verified publisher mark.
- Trader status: **trader**. CopperChunk Limited supplies services commercially, so under
  the EU Digital Services Act the listing must publish a physical address and a telephone
  number. Use the CopperChunk Limited registered office address. CopperChunk Limited is a
  private limited company registered in the Republic of Ireland (company number 576053).
