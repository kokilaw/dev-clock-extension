# DevClock

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![BDD Tested](https://img.shields.io/badge/BDD-Cucumber-23D96C)
![Browser Automation](https://img.shields.io/badge/Browser%20Automation-Playwright-2EAD33?logo=playwright&logoColor=white)

DevClock is a compact Chrome extension popup that helps engineers convert timestamps from common source timezones (US/Eastern, UTC, UK/London, Local) into Australia/Melbourne time and generate Splunk-ready query windows.

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

`![DevClock popup](docs/popup-screenshot.png)`

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

Inputs are tried in priority order until one succeeds.

### Unix Epoch

| Format | Example | Notes |
|--------|---------|-------|
| Epoch seconds (10 digits) | `1718000000` | Parsed as UTC |
| Epoch milliseconds (13 digits) | `1718000000000` | Parsed as UTC |

### ISO 8601

| Format | Example | Notes |
|--------|---------|-------|
| UTC (`Z` suffix) | `2024-06-10T14:30:00Z` | Timezone ignored from toggle |
| With ms + UTC | `2026-04-25T04:15:22.455Z` | Sub-second precision preserved in display |
| With explicit offset | `2024-06-10T09:00:00-05:00` | Offset respected as-is |
| Naive (no timezone) | `2024-06-10T14:30:00` | Interpreted in selected source timezone |
| Space separator | `2026-04-25 04:15Z` | Luxon accepts both `T` and space |

### Natural Language

| Format | Example | Notes |
|--------|---------|-------|
| Time only (24h) | `09:00`, `14:30`, `08:30:45` | Defaults to today's date in source TZ |
| Time only (12h AM/PM) | `3:14pm`, `9am` | Case-insensitive |
| Military time (no colon) | `1545`, `0900` | 4-digit HHMM format |
| Today + time | `today at 5pm`, `today 14:30` | |
| Yesterday + time | `yesterday at 5pm` | |
| Tomorrow + time | `tomorrow 9am` | |
| Last weekday + time | `last Monday 08:30`, `last Friday at 3pm` | |
| Month + day + time | `October 30th 2pm`, `January 1st 9am` | Uses current year; DST-aware |

### Timezone toggle behaviour

- All inputs **without** an explicit timezone are interpreted in the **selected source timezone**.
- Inputs that carry explicit timezone information (`Z`, `±HH:MM` offset) ignore the toggle and use the declared offset.
- Switching the toggle re-runs the conversion instantly — useful for comparing "same wall-clock time in different zones".
- The selected timezone is persisted via `localStorage` and restored on next open.

## Tech stack

- HTML/CSS popup UI
- Vanilla JavaScript logic in `converter-controller.js`
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
- `converter-popup.html`
- `converter-controller.js`
- `lib/luxon.min.js`
- `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

Commands:

- Build extension output: `npm run build:extension`
- Package zip for sharing/release: `npm run package:extension`

This keeps development/test tooling out of the installed extension.

### Snapshot vs release artifacts

- CI on push/PR uploads snapshot artifacts named `dev-clock-extention-snapshot-<commit_sha>.zip` (short retention).
- Tagged releases (`v*.*.*`) run a dedicated release workflow and publish `dev-clock-extention-v<package.json version>.zip` to GitHub Releases.
- Release workflow enforces tag/package version match (for example, tag `v1.2.3` must match `package.json` version `1.2.3`).

Release helpers in `package.json`:

- `npm run release:patch`
- `npm run release:minor`
- `npm run release:major`

These run tests before bumping (`preversion`) and push commit + tag automatically (`postversion`).

## Development notes

- The popup uses local Luxon (`lib/luxon.min.js`) to stay MV3-compatible.
- No remote CDN runtime scripts are required.
- Core conversion logic is kept in `converter-controller.js` helper functions for portability.

## Run integration tests (BDD / Gherkin)

This repo uses Cucumber (`.feature` files) with Playwright-powered browser steps.
The tests open `dist/converter-popup.html` in a normal browser tab and validate behavior end-to-end.

1. Install dependencies:

   `npm install`

2. Install Playwright browser runtime (first time only):

   `npx playwright install chromium`

3. Run tests:

   `npm run test:integration`

Feature file location:

- `tests/bdd/features/popup_conversion.feature`

Covered scenarios:
- ISO UTC conversion to Melbourne time
- ISO 8601 with milliseconds (sub-second precision preserved)
- Naive ISO interpreted using selected source timezone
- Unix epoch seconds conversion + Splunk preview window
- Time-only input defaults to today's date in source timezone
- Military time without colons (`1545` → 15:45)
- Natural-language: `yesterday at 5pm`, `last Monday`, `October 30th 2pm`
- DST cross-over offset validation (Melbourne vs. source zone)
- `Z`-suffixed input ignores source timezone toggle
- Toggle change updates conversion and Splunk range instantly
- Invalid input shows parse error and disables copy buttons
- Auto-focus on popup open
- Persistent toggle state across reload (via `localStorage`)

## Repository structure

```
dev-clock-extention/
├── manifest.json
├── converter-popup.html
├── converter-controller.js
├── lib/
│   └── luxon.min.js
├── icons/
├── scripts/
│   ├── build-extension.js
│   └── sync-luxon.js
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
