# LogTime Sync

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Playwright Tested](https://img.shields.io/badge/Tested%20with-Playwright-2EAD33?logo=playwright&logoColor=white)

LogTime Sync is a compact Chrome extension popup that helps engineers convert timestamps from common source timezones (US/Eastern, UTC, UK/London, Local) into Australia/Melbourne time and generate Splunk-ready query windows.

## Why this exists

When troubleshooting logs, teams often receive timestamps from mixed regions and formats. This tool removes manual timezone math and gives a copy-ready Splunk time fragment instantly.

## Features

- Converts to `Australia/Melbourne` with DST-aware handling via Luxon
- Supports multiple input styles (natural language, epoch, ISO)
- Generates a Splunk window fragment (`±1 minute` by default)
- Copy actions for converted time and Splunk fragment
- Web-app style Playwright integration coverage for core scenarios

## Demo / screenshot

Add a screenshot at `docs/popup-screenshot.png`, then use:

`![LogTime Sync popup](docs/popup-screenshot.png)`

## Quick start

### 1) Load as unpacked extension

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder

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

## Development notes

- The popup uses local Luxon (`lib/luxon.min.js`) to stay MV3-compatible.
- No remote CDN runtime scripts are required.
- Core conversion logic is kept in `popup.js` helper functions for portability.

## Run integration tests

This repo uses Playwright to open `popup.html` in a normal browser tab (web-app style) and validate behavior.

1. Install dependencies:

   `npm install`

2. Install Playwright browser runtime (first time only):

   `npx playwright install chromium`

3. Run tests:

   `npm run test:integration`

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
│   └── integration/
├── package.json
└── playwright.config.js
```

## Roadmap ideas

- Configurable Splunk window size in UI
- Optional 12h/24h display toggle
- One-click paste into active tab input (if permissions are added)
