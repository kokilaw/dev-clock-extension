# LogTime Sync

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![BDD Tested](https://img.shields.io/badge/BDD-Cucumber-23D96C)
![Browser Automation](https://img.shields.io/badge/Browser%20Automation-Playwright-2EAD33?logo=playwright&logoColor=white)

LogTime Sync is a compact Chrome extension popup that helps engineers convert timestamps from common source timezones (US/Eastern, UTC, UK/London, Local) into Australia/Melbourne time and generate Splunk-ready query windows.

## Why this exists

When troubleshooting logs, teams often receive timestamps from mixed regions and formats. This tool removes manual timezone math and gives a copy-ready Splunk time fragment instantly.

## Features

- Converts to `Australia/Melbourne` with DST-aware handling via Luxon
- Supports multiple input styles (natural language, epoch, ISO)
- Generates a Splunk window fragment (`±1 minute` by default)
- Copy actions for converted time and Splunk fragment
- BDD-style `.feature` coverage with Cucumber + Playwright

## Demo / screenshot

Add a screenshot at `docs/popup-screenshot.png`, then use:

`![LogTime Sync popup](docs/popup-screenshot.png)`

## Quick start

### 1) Load as unpacked extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

> Best practice: load `dist/` (built output) in Chrome, not the repository root.

Default command shortcut:
- Windows/Linux: `Ctrl+Shift+T`
- macOS: `Cmd+Shift+T`

If needed, update it at `chrome://extensions/shortcuts`.

### 2) Use the popup

Enter a timestamp, choose source timezone, and copy:
- Melbourne converted time
- Splunk fragment (±1 minute window)

Sample output:

`_time >= "2024-06-10T14:29:00+10:00" AND _time <= "2024-06-10T14:31:00+10:00"`

## Supported input formats

- Natural language: `3:14pm`, `09:00`, `yesterday at 5pm`, `last Monday 08:30`
- Unix epoch seconds: `1718000000`
- Unix epoch milliseconds: `1718000000000`
- ISO 8601 with timezone: `2024-06-10T14:30:00Z`, `2024-06-10T09:00:00-05:00`
- ISO 8601 without timezone (interpreted in selected source TZ): `2024-06-10T14:30:00`

## Tech stack

- HTML/CSS popup UI
- Vanilla JavaScript logic in `popup.js`
- Luxon (local bundle) in `lib/luxon.min.js`
- Chrome Extension Manifest V3 (`manifest.json`)

### Luxon management

Luxon is pinned via npm and synced automatically into `lib/luxon.min.js` during `build:extension`.
This keeps the extension runtime local-file requirement intact while avoiding manual library drift.

- Sync manually if needed: `npm run sync:luxon`
- Upgrade Luxon: `npm install luxon@latest` (then commit `package-lock.json` and `lib/luxon.min.js`)

## Build and package (recommended)

Building creates a minimal extension payload in `dist/` with only runtime files required by Chrome:

- `manifest.json`
- `popup.html`
- `popup.js`
- `lib/luxon.min.js`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

Commands:

- Build extension output: `npm run build:extension`
- Package zip for sharing/release: `npm run package:extension`

This keeps development/test tooling out of the installed extension.

## Development notes

- The popup uses local Luxon (`lib/luxon.min.js`) to stay MV3-compatible.
- No remote CDN runtime scripts are required.
- Core conversion logic is kept in `popup.js` helper functions for portability.

## Run integration tests (BDD / Gherkin)

This repo uses Cucumber (`.feature` files) with Playwright-powered browser steps.
The tests open `dist/popup.html` in a normal browser tab and validate behavior end-to-end.

1. Install dependencies:

   `npm install`

2. Install Playwright browser runtime (first time only):

   `npx playwright install chromium`

3. Run tests:

   `npm run test:integration`

Feature file location:

- `tests/bdd/features/popup_conversion.feature`

Covered scenarios:
- ISO UTC conversion
- Naive ISO + selected source timezone
- Unix epoch conversion + Splunk preview
- Natural-language parsing
- Invalid-input error behavior

## Repository structure

```
log-time-sync/
├── manifest.json
├── popup.html
├── popup.js
├── lib/
│   └── luxon.min.js
├── icons/
├── tests/
│   └── bdd/
│       ├── features/
│       ├── steps/
│       └── support/
├── package.json
└── playwright.config.js
```

## Roadmap ideas

- Configurable Splunk window size in UI
- Optional 12h/24h display toggle
- One-click paste into active tab input (if permissions are added)
