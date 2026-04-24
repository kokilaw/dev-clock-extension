# LogTime Sync — Chrome Extension

A Manifest V3 Chrome Extension for engineers who need to convert US/UK/UTC timestamps
to Australia/Melbourne time for Splunk log searches.

---

## File Structure

```
logtime-sync/
├── manifest.json
├── popup.html
├── popup.js
├── lib/
│   └── luxon.min.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Step 1 — Create Icons

Chrome requires icon PNGs. The quickest path is to generate them with ImageMagick
(if installed), or use any image editor.

### Option A — ImageMagick (terminal)

```bash
mkdir -p icons

# Creates a simple dark circle with a clock hand — replace with your own art
for SIZE in 16 48 128; do
  convert -size ${SIZE}x${SIZE} xc:#0d0f12 \
    -fill none -stroke "#3d8eff" -strokewidth $((SIZE/14+1)) \
    -draw "circle $((SIZE/2)),$((SIZE/2)) $((SIZE/2)),$((SIZE/8))" \
    -stroke "#00d4c8" -strokewidth $((SIZE/12+1)) \
    -draw "line $((SIZE/2)),$((SIZE/2)) $((SIZE*2/3)),$((SIZE/3))" \
    icons/icon${SIZE}.png
done
```

### Option B — Quick placeholder (Python)

```python
#!/usr/bin/env python3
"""Run from the logtime-sync/ directory to generate placeholder icons."""
import struct, zlib, os

def make_png(size, color=(13, 15, 18)):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    r, g, b = color
    raw = b''.join(b'\x00' + bytes([r, g, b] * size) for _ in range(size))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw))
    png += chunk(b'IEND', b'')
    return png

os.makedirs('icons', exist_ok=True)
for size in (16, 48, 128):
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(make_png(size))
print("Icons created in icons/")
```

Save as `make_icons.py` and run: `python3 make_icons.py`

---

## Step 2 — Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle **Developer mode** ON (top-right switch)
3. Click **"Load unpacked"**
4. Select the `logtime-sync/` folder
5. The extension appears in your toolbar — pin it for quick access

---

## Step 3 — Use the Hotkey

The default shortcut is **Ctrl+Shift+T** (Windows/Linux) or **Cmd+Shift+T** (Mac).

To change it:
1. Go to `chrome://extensions/shortcuts`
2. Find "LogTime Sync" → "Open LogTime Sync"
3. Set your preferred combo

> ⚠️  Some shortcuts may conflict with Chrome built-ins (e.g. Ctrl+Shift+T reopens
>     closed tabs by default). If it doesn't fire, change it in the shortcuts page.

---

## Step 4 — Reload After Edits

After changing `popup.js` or `popup.html`, click the **↺ refresh icon** on the
extension card at `chrome://extensions/` — no need to reload Chrome itself.

---

## Libraries

`popup.html` now loads `lib/luxon.min.js` locally, which is required for Manifest V3.
Remote CDN-hosted scripts are blocked in Chrome extensions, so keep runtime
dependencies bundled inside the project.

The natural-language inputs shown below are parsed by lightweight logic in
`popup.js`, so no extra runtime parsing library is required.

---

## Migrating to a Content Script Overlay

`popup.js` is designed for easy migration. The portable layer is:

```
parseTimestamp(raw, sourceTz)    → { millis } | { error }
convertToMelbourne(millis)       → Luxon DateTime
buildSplunkFragment(melbDT, win) → string
```

To build a Content Script overlay:
1. Create `content.js`, import or inline the three functions above
2. Inject a `<div>` overlay with the same HTML structure from `popup.html`
3. Wire keyboard shortcut via `chrome.commands` → `content-script` message
4. Register it in `manifest.json` under `content_scripts` + `web_accessible_resources`

---

## Splunk Fragment Format

```
_time >= "2024-06-10T14:29:00+10:00" AND _time <= "2024-06-10T14:31:00+10:00"
```

Paste directly into a Splunk search bar. The ±1 minute window is configurable via
`SPLUNK_WINDOW` at the top of `popup.js`.

---

## Supported Input Formats

| Input | Example |
|---|---|
| Natural language | `3:14pm`, `09:00`, `yesterday at 5pm`, `last Monday 08:30` |
| Unix epoch (seconds) | `1718000000` |
| Unix epoch (ms) | `1718000000000` |
| ISO 8601 with tz | `2024-06-10T14:30:00Z`, `2024-06-10T09:00:00-05:00` |
| ISO 8601 no tz | `2024-06-10T14:30:00` (uses selected Source TZ) |
