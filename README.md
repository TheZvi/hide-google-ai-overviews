# Hide Google AI Overviews

A small Chrome extension that removes **AI Overviews** and the **AI Mode** tab from Google Search, and keeps itself up to date. It's built for schools and other organizations that want to deploy it to every managed Chromebook or Chrome browser and then leave it alone.

- **What it does:** hides the AI Overview box, hides the AI Mode tab and button, and sends AI Mode links (`udm=50`) back to normal search. You can optionally switch every search to Google's plain "Web" results (`udm=14`).
- **What it doesn't do:** it makes no network requests, collects no data, and loads no remote code. Its only permission is `storage`, which holds its three settings. It runs only on Google Search domains.
- **How it finds the overview:** it looks for the visible "AI Overview" heading and its page structure, not Google's scrambled CSS class names. So it survives most of Google's frequent redesigns.

## Install

### For one computer
1. Download `hide-google-ai-overviews.zip` from the [latest release](../../releases/latest) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the unzipped folder.

(This copy won't auto-update. For auto-updates, use the managed install below or the Chrome Web Store listing, if there is one.)

### For a school or organization (auto-updating)
See **[docs/ADMIN.md](docs/ADMIN.md)**. In short: in the Google Admin console, force-install extension ID `hcfbhhjmjpnbacblkloeocoiaaafjbdi` from the custom update URL

```
https://thezvi.github.io/hide-google-ai-overviews/updates.xml
```

Every managed device then picks up each new release on its own.

## How it maintains itself

```
 Google changes its page ──► Daily live check (GitHub Actions) ──┐
                             or a user files a "broken" issue ───┤
                                                                 ▼
                                  Auto-fix workflow (Claude Code, optional)
                                  updates the detection logic + tests, opens a PR
                                                                 │  maintainer merges
                                                                 ▼
                     Release workflow: test → version → sign .crx → publish
                     GitHub Pages updates.xml (+ Chrome Web Store, if configured)
                                                                 │
                                                                 ▼
                     Every managed Chrome updates itself within a few hours
```

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | every push / PR | Runs the offline test suite: synthetic Google pages, with the real extension loaded in Chromium |
| `release.yml` | push to `main` touching `extension/` | Tests, assigns the version `1.0.<run>`, signs the `.crx`, publishes `updates.xml` to Pages, creates a GitHub Release, and optionally uploads to the Chrome Web Store |
| `live-check.yml` | daily | Loads real Google searches with the extension and opens a `broken` issue if an overview shows through |
| `auto-fix.yml` | issue labelled `broken` | Optional: Claude Code writes a fix and a regression test, then opens a PR. Needs an `ANTHROPIC_API_KEY` secret |

**Known limitation:** Google often shows a CAPTCHA to automated browsers, especially from GitHub's datacenter IPs. When that happens the daily check reports "blocked" (inconclusive) rather than failing. The real backstop is a human filing the **"AI Overviews are showing again"** issue; the attached page HTML is what lets the auto-fix work. Run the live check yourself with a visible browser (you may need to solve one CAPTCHA):

```
npm install && npx playwright install chromium
npm run live-check -- --headed
```

## Repository secrets

| Secret | Required? | Purpose |
|---|---|---|
| `CRX_PRIVATE_KEY` | yes, for self-hosted updates | Signs the `.crx`. **Never change or lose it:** the extension ID comes from this key |
| `ANTHROPIC_API_KEY` | optional | Turns on automatic fix PRs |
| `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`, `CWS_EXTENSION_ID` | optional | Auto-publish to the Chrome Web Store |

## Development

```
npm install
npx playwright install chromium
npm test                       # offline fixture tests
npm run live-check -- --headed # real Google
npm run build                  # dist/ (set CRX_PRIVATE_KEY to also build the signed .crx)
```

The logic lives in `extension/content.js`. When Google changes its markup, add a fixture to `test/fixtures.mjs` that reproduces the change, then fix the detection.

Translations of the "AI Overview" label for other languages are best-effort. Pull requests are welcome.

## License

MIT
