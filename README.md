# DevClock

## Privacy Policy

[https://kokilaw.github.io/dev-clock-extention/privacy-policy.html](https://kokilaw.github.io/dev-clock-extention/privacy-policy.html)

---

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![BDD Tested](https://img.shields.io/badge/BDD-Cucumber-23D96C)
![Browser Automation](https://img.shields.io/badge/Browser%20Automation-Playwright-2EAD33?logo=playwright&logoColor=white)

DevClock is a compact Chrome extension that helps engineers convert timestamps from configurable source timezones into a configurable local target timezone and generate copy-ready query windows for multiple providers.

## Why this exists

When troubleshooting logs, teams often receive timestamps from mixed regions and formats. This tool removes manual timezone math and gives a copy-ready query fragment instantly.

## Features

- Converts to configured target timezone (`localTimezone`) with DST-aware handling via Luxon
- Supports multiple input styles (epoch, ISO, shorthand, natural language, and log-native formats)
- Generates provider-specific query windows (`±1 minute` by default)
- Supports query output providers: `splunk`, `grafana`, `cloudwatch`
- Supports 12h/24h display modes from preferences
- Source timezone toggles and target timezone dropdown options are configurable from the Preferences page
- Copy actions for converted time and provider query fragment
- Separate unit + integration coverage for parser logic and UI flows

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
- Converted time in configured target timezone
- Query fragment (provider-specific, ±1 minute window)

Sample output (Splunk):

`_time >= "2024-06-10T14:29:00+10:00" AND _time <= "2024-06-10T14:31:00+10:00"`

## Supported input formats

Inputs are tried in priority order until one succeeds.

### Input cleanup / shorthand

| Format | Example | Notes |
|--------|---------|-------|
| Bracket / noise wrapped input | `[2024-06-10T14:30:00Z]`, `("2024-06-10T14:30:00Z")` | Surrounding wrappers and extra whitespace are stripped before parsing |
| Relative shorthand | `-2h`, `-30m`, `now-1h`, `-45s` | Relative to current time in the effective source timezone |

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
| With trailing TZ abbreviation | `2026-04-25T14:30:00 PST` | Trailing abbreviation is resolved locally for that parse only |

### Log-native / loose parser formats

| Format | Example | Notes |
|--------|---------|-------|
| Apache CLF-style | `10/Oct/2000:13:55:36 -0700` | Parsed through the log-native fallback pipeline |
| Syslog-like timestamp | `Oct 10 13:55:36` | Useful for server / daemon log entries |
| Space-separated datetime with ms | `2026-04-25 14:30:22.455` | Accepted by the loose parser stage |
| Time with milliseconds | `14:30:22.455` | Defaults to today when no date component is present |

### Timezone abbreviations

| Format | Example | Notes |
|--------|---------|-------|
| Trailing abbreviation | `2026-04-25 14:30 EST`, `2026-04-25 14:30 AEDT`, `2026-04-25 14:30 BST` | Uses `timezoneAbbreviations` to resolve to an IANA zone locally for the current call |

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
| chrono fallback phrases | `next friday 4pm`, `2 hours ago`, `tomorrow noon` | Parsed via `chrono` when the lightweight parser does not match |

## Preferences page

Open popup → click **Preferences**.

The settings page supports:
- Default target timezone (`localTimezone`) used as the popup target timezone default
  - defaults to the current browser timezone
- Time zone display options list management (`sourceTimezones`)
   - defaults are `UTC` and `LOCAL`
   - `LOCAL` is always preserved and non-removable
   - `UTC` is removable
   - duplicates are prevented
- Active source timezone persistence (`activeSourceTimezone`)
- Query provider selection (`splunk`, `grafana`, `cloudwatch`)
- Time display mode (`24h` or `12h`)

All preferences persist across browser restarts.

### Timezone toggle behavior

- All inputs **without** an explicit timezone are interpreted in the **selected source timezone**.
- Inputs that carry explicit timezone information (`Z`, `±HH:MM` offset) ignore the toggle and use the declared offset.
- Switching the toggle re-runs the conversion instantly — useful for comparing "same wall-clock time in different zones".
- The selected timezone is persisted in the shared preferences schema and restored on next open.
- Source toggles in popup are rendered dynamically from configured `sourceTimezones`.
- Target timezone dropdown options in popup are also rendered from configured `sourceTimezones`.

### Query provider behavior

Query preview and copy output follow the selected provider:
- `splunk`: `_time >= "..." AND _time <= "..."`
- `grafana`: `from=<epoch_ms>&to=<epoch_ms>`
- `cloudwatch`: `filter @timestamp >= '...' and @timestamp <= '...'`

### 12h/24h display behavior

- `24h` mode uses `HH:mm:ss`
- `12h` mode uses `h:mm:ss a`
- Applies to human-facing popup time displays (source, converted, now badge)
- Query timestamps remain machine-oriented provider output

### Migration note (legacy users)

On first load after upgrade, legacy `sourceTz` is migrated into the new preferences schema (`devClockPreferences`) and then removed.

## Tech stack

- HTML/CSS popup UI
- Vanilla JavaScript logic in `src/popup/converter-controller.js`
- Shared parser module in `src/shared/timestamp-parser.js`
- Luxon (local bundle) in `lib/luxon.min.js`
- `chrono`, `anyDateParser`, and timezone abbreviation resolution available as globals
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
- `src/popup/converter-controller.js`
- `src/shared/timestamp-parser.js`
- `options.html`
- `src/options/options.js`
- `src/shared/preferences.js`
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
- Parsing logic is isolated in `src/shared/timestamp-parser.js` so it can be unit-tested separately from popup UI wiring.
- `src/popup/converter-controller.js` remains the popup/controller layer and delegates parsing to the shared parser module.

## Run unit tests

The timestamp parsing pipeline has a standalone unit suite separate from browser integration coverage.

Run it with:

`npm run test:unit`

Current unit coverage includes:
- Existing epoch, ISO, military-time, and lightweight natural-language scenarios
- Bracket / noise normalization
- Relative shorthand like `-2h`, `-30m`, and `now-1h`
- Trailing timezone abbreviation resolution
- `anyDateParser` fallback for log-native formats
- Time-only loose-parser results defaulting to today

## Run integration tests (BDD / Gherkin)

This repo uses Cucumber (`.feature` files) with Playwright-powered browser steps.
The tests start from `dist/converter-popup.html` in a normal browser tab and validate popup + options flows end-to-end.

1. Install dependencies:

   `npm install`

2. Install Playwright browser runtime (first time only):

   `npx playwright install chromium`

3. Run tests:

   `npm run test:integration`

Feature file locations:

- `tests/bdd/features/popup_conversion.feature`
- `tests/bdd/features/options_preferences.feature`

Covered scenarios:
- ISO UTC conversion to configured target timezone
- ISO 8601 with milliseconds (sub-second precision preserved)
- Naive ISO interpreted using selected source timezone
- Unix epoch seconds conversion + query preview window
- Existing time-only input behavior remains covered end-to-end
- Military time without colons (`1545` → 15:45)
- Natural-language: `yesterday at 5pm`, `last Monday`, `October 30th 2pm`
- DST cross-over offset validation (target vs. source zone)
- `Z`-suffixed input ignores source timezone toggle
- Toggle change updates conversion and query range instantly
- Invalid input shows parse error and disables copy buttons
- Auto-focus on popup open
- Persistent toggle state across reload (via shared preferences)
- Dynamic source timezone toggle rendering from saved preferences
- Query preview/output switching for `splunk`, `grafana`, and `cloudwatch`
- 12h/24h display mode rendering
- Legacy `sourceTz` migration into shared preferences
- Options page timezone combobox options include UTC offset labels
- Options page provider combobox options render and save correctly
- Options page source timezone add + duplicate prevention behavior
- Options page invalid timezone validation behavior
- Options page save/reload persistence for timezone, provider, and hour format

## Repository structure

```
dev-clock-extention/
├── manifest.json
├── converter-popup.html
├── options.html
├── src/
│   ├── options/
│   │   └── options.js
│   ├── popup/
│   │   └── converter-controller.js
│   └── shared/
│       ├── preferences.js
│       └── timestamp-parser.js
├── lib/
│   └── luxon.min.js
├── icons/
├── scripts/
│   ├── build-extension.js
│   └── sync-luxon.js
├── tests/
│   ├── bdd/
│   │   ├── features/
│   │   ├── steps/
│   │   └── support/
│   └── unit/
│       └── timestamp-parser.test.js
├── package.json
└── playwright.config.js
```

## Roadmap ideas

- Configurable query window size in UI
- Additional query providers
- One-click paste into active tab input (if permissions are added)
