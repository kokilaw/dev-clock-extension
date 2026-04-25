/**
 * DevClock — converter-controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts source timestamps to the configured target local timezone.
 * Stack: Luxon (timezone math + lightweight NLP parsing)
 *
 * Architecture note: All conversion logic lives in the pure functions at the
 * bottom of this file (parseTimestamp, convertToTargetZone, buildSplunkFragment).
 * To migrate to a Content Script Overlay, import/copy only those functions —
 * the UI wiring in init() is the only popup-specific part.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const Luxon = globalThis.luxon || globalThis.Luxon;
const Parser = globalThis.DevClockTimestampParser;

if (!Luxon || !Luxon.DateTime) {
  throw new Error("Luxon failed to load. Ensure converter-popup.html loads lib/luxon.min.js before src/popup/converter-controller.js.");
}

if (!Parser || typeof Parser.parseTimestamp !== "function") {
  throw new Error("Timestamp parser failed to load. Ensure converter-popup.html loads src/shared/timestamp-parser.js before src/popup/converter-controller.js.");
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_TARGET_TZ = "Australia/Melbourne";
const SPLUNK_WINDOW = 1; // ± minutes for the Splunk fragment
const PREFERENCES_STORAGE_KEY = "devClockPreferences";

const TZ_DISPLAY_NAMES = {
  "America/New_York": "US/ET",
  "UTC":              "UTC",
  "Europe/London":    "UK/LON",
  "LOCAL":            "LOCAL",
};

const TZ_BUTTON_IDS = {
  "America/New_York": "tz-us",
  "UTC": "tz-utc",
  "Europe/London": "tz-uk",
  "LOCAL": "tz-local",
};

const DEFAULT_SOURCE_TIMEZONES = ["UTC", "LOCAL"];

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  sourceTz:          "America/New_York",
  parsedMillis:      null,
  melbourneISO:      null,
  prefs:             null,
  queryProvider:     "splunk",
  queryPreviewExpanded: false,
  hourFormat:        "24h",
  targetTz:          DEFAULT_TARGET_TZ,
  targetTzSelection: "LOCAL",
};

// ── DOM refs ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const els = {
  input:            $("timeInput"),
  clearBtn:         $("clearBtn"),
  tzToggles:        $("tzToggles"),
  resultEmpty:      $("resultEmpty"),
  resultCard:       $("resultCard"),
  resultFromTz:     $("resultFromTz"),
  resultFromTime:   $("resultFromTime"),
  resultTime:       $("resultTime"),
  resultDate:       $("resultDate"),
  resultUnix:       $("resultUnix"),
  resultISO:        $("resultISO"),
  errorMsg:         $("errorMsg"),
  splunkPreview:    $("splunkPreview"),
  queryPreviewToggle: $("queryPreviewToggle"),
  splunkText:       $("splunkPreviewText"),
  queryPreviewLabel: $("queryPreviewLabel"),
  targetMeta:       $("targetMeta"),
  resultTargetBadge: $("resultTargetBadge"),
  targetTzBtn:      $("targetTzBtn"),
  targetTzDropdown: $("targetTzDropdown"),
  btnOpenPreferences: $("btnOpenPreferences"),
  nowBadge:         $("nowBadge").querySelector("span"),
};

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Returns the current UTC offset string (e.g. "−05:00") for a given IANA zone.
 */
function getOffsetLabel(ianaZone) {
  if (ianaZone === "LOCAL") {
    const localZone = state.prefs?.localTimezone || Luxon.DateTime.local().zoneName;
    return Luxon.DateTime.now().setZone(localZone).toFormat("ZZ");
  }
  const dt = Luxon.DateTime.now().setZone(ianaZone);
  return dt.toFormat("ZZ");
}

function normalizeSourceTimezones(timezones) {
  const normalized = [];

  for (const zone of Array.isArray(timezones) ? timezones : []) {
    if (typeof zone !== "string" || !zone.trim()) continue;
    if (!normalized.includes(zone)) normalized.push(zone);
  }

  for (const required of ["LOCAL"]) {
    if (!normalized.includes(required)) normalized.push(required);
  }

  if (!normalized.length) return [...DEFAULT_SOURCE_TIMEZONES];
  return normalized;
}

function getSourceZoneName(sourceTz) {
  if (sourceTz === "LOCAL") {
    return state.prefs?.localTimezone || Luxon.DateTime.local().zoneName;
  }

  return sourceTz;
}

function getTargetZoneName() {
  const sel = state.targetTzSelection || "LOCAL";
  if (sel === "LOCAL") {
    return state.targetTz || DEFAULT_TARGET_TZ;
  }
  return sel;
}

function getTimezoneDisplayName(timezone) {
  if (TZ_DISPLAY_NAMES[timezone]) return TZ_DISPLAY_NAMES[timezone];
  if (typeof timezone !== "string") return "Unknown";

  const tail = timezone.includes("/") ? timezone.split("/").pop() : timezone;
  return tail.replace(/_/g, " ");
}

function getTargetDisplayName() {
  const target = getTargetZoneName();
  return target.includes("/") ? target.split("/").pop().replace(/_/g, " ") : target;
}

function createTimezoneButton(timezone) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tz-btn";
  btn.dataset.tz = timezone;

  if (TZ_BUTTON_IDS[timezone]) {
    btn.id = TZ_BUTTON_IDS[timezone];
  }

  const name = document.createElement("span");
  name.className = "tz-btn-name";
  name.textContent = getTimezoneDisplayName(timezone);

  const offset = document.createElement("span");
  offset.className = "tz-btn-offset";
  offset.textContent = getOffsetLabel(timezone);

  btn.appendChild(name);
  btn.appendChild(offset);
  return btn;
}

function renderTimezoneToggles(timezones, activeTz) {
  if (!els.tzToggles) return;

  const zones = normalizeSourceTimezones(timezones);
  const selected = zones.includes(activeTz) ? activeTz : zones[0];

  els.tzToggles.innerHTML = "";

  for (const zone of zones) {
    const btn = createTimezoneButton(zone);

    btn.addEventListener("click", async () => {
      applyActiveTimezone(zone);
      await saveActiveTimezonePreference(zone);
      runConversion();
    });

    els.tzToggles.appendChild(btn);
  }

  applyActiveTimezone(selected);
}

/**
 * Format a Luxon DateTime in target timezone as a tidy ISO string for Splunk.
 * Splunk's _time field uses ISO 8601 with no space: 2024-06-10T14:30:00+10:00
 */
function toSplunkISO(luxonDT) {
  return luxonDT.setZone(getTargetZoneName()).toISO({ suppressMilliseconds: true });
}

// ── Core Logic (portable — no DOM deps) ───────────────────────────────────

/**
 * parseTimestamp(raw, sourceTz)
 *
 * Tries, in order:
 *   1. Unix epoch seconds  (10 digits)
 *   2. Unix epoch ms       (13 digits)
 *   3. ISO 8601 string     (Luxon fromISO)
 *   4. Natural language    (lightweight parser anchored in sourceTz)
 *
 * Returns: { millis: number } on success, { error: string } on failure.
 */
function parseTimestamp(raw, sourceTz) {
  return Parser.parseTimestamp(raw, sourceTz, {
    localTimezone: state.prefs?.localTimezone,
    now: Luxon.DateTime.now(),
  });
}

function parseNaturalTimestamp(raw, nowInSource, zone) {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");

  const relativeMatch = normalized.match(/^(today|yesterday|tomorrow)(?:\s+at)?(?:\s+(.+))?$/i);
  if (relativeMatch) {
    const [, keyword, timePart] = relativeMatch;
    const dayOffsets = { today: 0, yesterday: -1, tomorrow: 1 };
    const base = nowInSource.plus({ days: dayOffsets[keyword] }).startOf("day");
    return applyParsedTime(base, parseTimeOfDay(timePart), zone);
  }

  const lastWeekdayMatch = normalized.match(/^(last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at)?(?:\s+(.+))?$/i);
  if (lastWeekdayMatch) {
    const [, , weekdayName, timePart] = lastWeekdayMatch;
    const targetWeekday = weekdayNameToNumber(weekdayName);
    const daysBack = ((nowInSource.weekday - targetWeekday + 7) % 7) || 7;
    const base = nowInSource.minus({ days: daysBack }).startOf("day");
    return applyParsedTime(base, parseTimeOfDay(timePart), zone);
  }

  const timeOnly = parseTimeOfDay(normalized);
  if (timeOnly) {
    return applyParsedTime(nowInSource.startOf("day"), timeOnly, zone);
  }

  // Month DDth [timePart] — e.g. "October 30th 2pm"
  const MONTHS = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
  };
  const monthDayMatch = normalized.match(
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+at)?(?:\s+(.+))?$/i
  );
  if (monthDayMatch) {
    const [, monthName, dayStr, timePart] = monthDayMatch;
    const month = MONTHS[monthName.toLowerCase()];
    const day   = parseInt(dayStr, 10);
    const year  = nowInSource.year;
    const base  = Luxon.DateTime.fromObject({ year, month, day }, { zone });
    if (base.isValid) return applyParsedTime(base, parseTimeOfDay(timePart), zone);
  }

  return null;
}

function applyParsedTime(baseDate, parsedTime, zone) {
  const time = parsedTime || { hour: 0, minute: 0, second: 0 };
  const withTime = Luxon.DateTime.fromObject(
    {
      year: baseDate.year,
      month: baseDate.month,
      day: baseDate.day,
      hour: time.hour,
      minute: time.minute,
      second: time.second,
    },
    { zone }
  );

  return withTime.isValid ? withTime : null;
}

function parseTimeOfDay(raw) {
  if (!raw) return null;

  // Military time without colons: 1545 → 15:45
  const militaryMatch = raw.trim().match(/^(\d{2})(\d{2})$/);
  if (militaryMatch) {
    const hour   = parseInt(militaryMatch[1], 10);
    const minute = parseInt(militaryMatch[2], 10);
    if (hour <= 23 && minute <= 59) return { hour, minute, second: 0 };
  }

  const match = raw.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*([ap]m)?$/i);
  if (!match) return null;

  let [, hours, minutes = "0", seconds = "0", meridiem] = match;
  let hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10);
  const second = parseInt(seconds, 10);

  if (minute > 59 || second > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }

  return { hour, minute, second };
}

function weekdayNameToNumber(weekdayName) {
  return {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  }[weekdayName.toLowerCase()] || null;
}

/**
 * convertToTargetZone(millis)
 *
 * Takes UTC epoch ms, returns a Luxon DateTime in configured target timezone.
 */
function convertToTargetZone(millis) {
  return Luxon.DateTime.fromMillis(millis, { zone: getTargetZoneName() });
}

/**
 * buildSplunkFragment(melbourneDT, windowMinutes)
 *
 * Returns a Splunk SPL time fragment:
 *   _time >= "2024-06-10T14:29:00+10:00" AND _time <= "2024-06-10T14:31:00+10:00"
 */
function buildSplunkFragment(melbourneDT, windowMinutes = SPLUNK_WINDOW) {
  const from = melbourneDT.minus({ minutes: windowMinutes });
  const to   = melbourneDT.plus({  minutes: windowMinutes });
  const fmt  = dt => dt.set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });
  return `_time >= "${fmt(from)}" AND _time <= "${fmt(to)}"`;
}

function buildGrafanaFragment(melbourneDT, windowMinutes = SPLUNK_WINDOW) {
  const from = melbourneDT.minus({ minutes: windowMinutes }).toUTC().toMillis();
  const to = melbourneDT.plus({ minutes: windowMinutes }).toUTC().toMillis();
  return `from=${from}&to=${to}`;
}

function buildCloudWatchFragment(melbourneDT, windowMinutes = SPLUNK_WINDOW) {
  const from = melbourneDT.minus({ minutes: windowMinutes }).toUTC().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });
  const to = melbourneDT.plus({ minutes: windowMinutes }).toUTC().set({ millisecond: 0 }).toISO({ suppressMilliseconds: true });
  return `filter @timestamp >= '${from}' and @timestamp <= '${to}'`;
}

const QUERY_PROVIDERS = {
  splunk: {
    name: "Splunk",
    build: buildSplunkFragment,
    highlight: syntaxHighlightSplunk,
  },
  grafana: {
    name: "Grafana",
    build: buildGrafanaFragment,
  },
  cloudwatch: {
    name: "CloudWatch",
    build: buildCloudWatchFragment,
  },
};

function getActiveProvider() {
  return QUERY_PROVIDERS[state.queryProvider] || QUERY_PROVIDERS.splunk;
}

function buildQueryFragment(melbourneDT) {
  return getActiveProvider().build(melbourneDT);
}

function renderQueryPreview(fragment) {
  const provider = getActiveProvider();
  if (provider.highlight) {
    els.splunkText.innerHTML = provider.highlight(fragment);
    return;
  }

  els.splunkText.textContent = fragment;
}

function applyProviderUi() {
  const provider = getActiveProvider();
  if (els.queryPreviewLabel) {
    els.queryPreviewLabel.textContent = `Query Preview · ${provider.name}`;
  }
}

function setQueryPreviewExpanded(expanded) {
  if (!els.splunkPreview) return;

  state.queryPreviewExpanded = !!expanded;
  els.splunkPreview.classList.toggle("expanded", state.queryPreviewExpanded);
  els.splunkPreview.classList.toggle("collapsed", !state.queryPreviewExpanded);

  if (els.queryPreviewToggle) {
    els.queryPreviewToggle.setAttribute("aria-expanded", state.queryPreviewExpanded ? "true" : "false");
  }
}

function applyTargetUi() {
  const targetName = getTargetDisplayName();
  const targetZone = getTargetZoneName();

  if (els.targetMeta) {
    els.targetMeta.textContent = `${targetName} ↔ Global`;
  }

  if (els.resultTargetBadge) {
    const sel = state.targetTzSelection || "LOCAL";
    els.resultTargetBadge.textContent = sel === "LOCAL" ? getTargetZoneName() : sel;
  }

  // Re-render dropdown options to reflect current zone list + active selection
  if (els.targetTzDropdown) {
    const zones = normalizeSourceTimezones(state.prefs?.sourceTimezones);
    els.targetTzDropdown.innerHTML = "";
    for (const zone of zones) {
      const li = document.createElement("li");
      li.role = "option";
      li.className = `target-tz-option${zone === (state.targetTzSelection || "LOCAL") ? " active" : ""}`;
      li.dataset.tz = zone;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = zone;

      const offsetSpan = document.createElement("span");
      offsetSpan.className = "target-tz-option-offset";
      offsetSpan.textContent = getOffsetLabel(zone);

      li.appendChild(nameSpan);
      li.appendChild(offsetSpan);

      li.addEventListener("click", () => {
        state.targetTzSelection = zone;
        closeTargetTzDropdown();
        applyTargetUi();
        runConversion();
      });

      els.targetTzDropdown.appendChild(li);
    }
  }
}

function openTargetTzDropdown() {
  if (!els.targetTzDropdown || !els.targetTzBtn) return;
  els.targetTzDropdown.classList.add("open");
  els.targetTzBtn.setAttribute("aria-expanded", "true");
}

function closeTargetTzDropdown() {
  if (!els.targetTzDropdown || !els.targetTzBtn) return;
  els.targetTzDropdown.classList.remove("open");
  els.targetTzBtn.setAttribute("aria-expanded", "false");
}

function formatTime(dt, includeSeconds = true) {
  const isTwelveHour = state.hourFormat === "12h";
  if (includeSeconds) {
    return dt.toFormat(isTwelveHour ? "h:mm:ss a" : "HH:mm:ss");
  }

  return dt.toFormat(isTwelveHour ? "h:mm a" : "HH:mm");
}

// ── Rendering ──────────────────────────────────────────────────────────────

function showError(msg) {
  els.resultCard.classList.remove("visible");
  els.resultEmpty.style.display = "none";
  els.errorMsg.textContent = `⚠ ${msg}`;
  els.errorMsg.classList.add("visible");
  els.splunkPreview.classList.remove("visible");
  els.input.classList.add("error");
  els.input.classList.remove("success");
  state.parsedMillis = null;
  state.melbourneISO = null;
}

function showEmpty() {
  els.resultCard.classList.remove("visible");
  els.resultEmpty.style.display = "flex";
  els.errorMsg.classList.remove("visible");
  els.splunkPreview.classList.remove("visible");
  els.input.classList.remove("error", "success");
  state.parsedMillis = null;
  state.melbourneISO = null;
}

function showResult(millis) {
  const targetDT = convertToTargetZone(millis);
  state.parsedMillis = millis;
  state.melbourneISO = targetDT.toISO({ suppressMilliseconds: true }); // clipboard copy always suppresses ms

  // Source time display
  const actualZone  = getSourceZoneName(state.sourceTz);
  const sourceDT    = Luxon.DateTime.fromMillis(millis, { zone: actualZone });

  els.resultFromTz.textContent   = getTimezoneDisplayName(state.sourceTz);
  els.resultFromTime.textContent = `${formatTime(sourceDT)} (${sourceDT.toFormat("dd LLL yyyy")})`;

  // Target display
  els.resultTime.textContent = formatTime(targetDT);
  els.resultDate.textContent = targetDT.toFormat("ccc, dd LLL yyyy");

  // Extra info
  els.resultUnix.textContent = Math.floor(millis / 1000);
  els.resultISO.textContent  = millis % 1000 === 0
    ? targetDT.toISO({ suppressMilliseconds: true })
    : targetDT.toISO();

  // Splunk preview
  const fragment = buildQueryFragment(targetDT);
  renderQueryPreview(fragment);

  // Show elements
  els.resultEmpty.style.display = "none";
  els.errorMsg.classList.remove("visible");
  els.resultCard.classList.add("visible");
  els.splunkPreview.classList.add("visible");
  setQueryPreviewExpanded(state.queryPreviewExpanded);
  els.input.classList.remove("error");
  els.input.classList.add("success");
}

/**
 * Very lightweight Splunk SPL syntax highlighter.
 */
function syntaxHighlightSplunk(fragment) {
  return fragment
    .replace(/(_time)/g, '<span class="kw">$1</span>')
    .replace(/(>=|<=|AND)/g, '<span class="op">$1</span>')
    .replace(/"([^"]+)"/g, '"<span class="val">$1</span>"');
}

// ── Controller ─────────────────────────────────────────────────────────────

function runConversion() {
  const raw = els.input.value;
  if (!raw.trim()) { showEmpty(); return; }

  const result = parseTimestamp(raw, state.sourceTz);
  if (result.error) {
    if (result.error === "empty") { showEmpty(); return; }
    showError(result.error);
    return;
  }

  showResult(result.millis);
}

function updateTzOffsets() {
  document.querySelectorAll(".tz-btn[data-tz]").forEach(btn => {
    const tz = btn.dataset.tz;
    const offsetEl = btn.querySelector(".tz-btn-offset");
    if (!offsetEl) return;
    offsetEl.textContent = getOffsetLabel(tz);
  });
}

async function copyToClipboard(text, feedbackEl) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    if (feedbackEl) {
      feedbackEl.classList.add("copied");
      setTimeout(() => {
        feedbackEl.classList.remove("copied");
      }, 950);
    }
  } catch (e) {
    console.error("Clipboard write failed:", e);
  }
}

function bindCopyable(el, getText) {
  if (!el || typeof getText !== "function") return;

  const triggerCopy = () => {
    const text = getText();
    if (!text) return;
    copyToClipboard(String(text), el);
  };

  el.addEventListener("click", event => {
    event.stopPropagation();
    triggerCopy();
  });

  el.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    triggerCopy();
  });
}

function updateNowBadge() {
  const now = Luxon.DateTime.now().setZone(getTargetZoneName());
  els.nowBadge.textContent = formatTime(now);
}

function applyActiveTimezone(timezone) {
  if (!timezone) return;
  const targetBtn = document.querySelector(`.tz-btn[data-tz="${timezone}"]`);
  if (!targetBtn) return;

  document.querySelectorAll(".tz-btn").forEach(b => b.classList.remove("active"));
  targetBtn.classList.add("active");
  state.sourceTz = timezone;
}

async function loadActiveTimezonePreference() {
  if (globalThis.DevClockPreferences?.getPreferences) {
    state.prefs = await globalThis.DevClockPreferences.getPreferences();
    state.queryProvider = state.prefs?.queryProvider || "splunk";
    state.hourFormat = state.prefs?.hourFormat || "24h";
    state.targetTz = state.prefs?.localTimezone || DEFAULT_TARGET_TZ;
    return state.prefs?.activeSourceTimezone || null;
  }

  state.prefs = {
    sourceTimezones: [...DEFAULT_SOURCE_TIMEZONES],
    localTimezone: DEFAULT_TARGET_TZ,
    queryProvider: "splunk",
    hourFormat: "24h",
  };
  state.queryProvider = "splunk";
  state.hourFormat = "24h";
  state.targetTz = state.prefs.localTimezone;

  return localStorage.getItem("sourceTz");
}

async function saveActiveTimezonePreference(timezone) {
  if (globalThis.DevClockPreferences?.savePreferences) {
    state.prefs = await globalThis.DevClockPreferences.savePreferences({ activeSourceTimezone: timezone });
    return;
  }

  localStorage.setItem("sourceTz", timezone);
}

async function refreshPreferencesFromStorage() {
  if (!globalThis.DevClockPreferences?.getPreferences) return;

  state.prefs = await globalThis.DevClockPreferences.getPreferences();
  state.queryProvider = state.prefs?.queryProvider || "splunk";
  state.hourFormat = state.prefs?.hourFormat || "24h";
  state.targetTz = state.prefs?.localTimezone || DEFAULT_TARGET_TZ;

  renderTimezoneToggles(state.prefs?.sourceTimezones, state.prefs?.activeSourceTimezone || state.sourceTz);
  applyProviderUi();
  applyTargetUi();
  updateTzOffsets();
  updateNowBadge();

  if (state.parsedMillis) {
    showResult(state.parsedMillis);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  // ── Live parsing on input ──
  els.input.addEventListener("input", () => {
    els.clearBtn.classList.toggle("visible", els.input.value.length > 0);
    runConversion();
  });

  // ── Keyboard shortcuts ──
  els.input.addEventListener("keydown", e => {
    if (e.key === "Enter")  { runConversion(); }
    if (e.key === "Escape") { els.input.value = ""; els.clearBtn.classList.remove("visible"); showEmpty(); }
  });

  // ── Clear button ──
  els.clearBtn.addEventListener("click", () => {
    els.input.value = "";
    els.clearBtn.classList.remove("visible");
    showEmpty();
    els.input.focus();
  });

  // ── Restore saved timezone ──
  const savedTz = await loadActiveTimezonePreference();
  renderTimezoneToggles(state.prefs?.sourceTimezones, savedTz || state.sourceTz);
  applyProviderUi();
  applyTargetUi();
  setQueryPreviewExpanded(false);

  // ── Query preview collapse toggle ──
  els.queryPreviewToggle?.addEventListener("click", () => {
    setQueryPreviewExpanded(!state.queryPreviewExpanded);
  });

  // ── Target timezone dropdown ──
  els.targetTzBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = els.targetTzDropdown?.classList.contains("open");
    if (isOpen) {
      closeTargetTzDropdown();
    } else {
      openTargetTzDropdown();
    }
  });

  document.addEventListener("click", () => closeTargetTzDropdown());

  // ── Inline copy targets ──
  bindCopyable(els.resultTime, () => (state.parsedMillis ? els.resultTime.textContent.trim() : ""));
  bindCopyable(els.resultUnix, () => (state.parsedMillis ? els.resultUnix.textContent.trim() : ""));
  bindCopyable(els.resultISO, () => (state.parsedMillis ? els.resultISO.textContent.trim() : ""));
  bindCopyable(els.splunkText, () => {
    if (!state.parsedMillis) return "";
    const targetDT = convertToTargetZone(state.parsedMillis);
    return buildQueryFragment(targetDT);
  });

  // ── Init tz offsets + live clock ──
  updateTzOffsets();
  updateNowBadge();
  setInterval(updateNowBadge, 1000);

  // ── Open preferences page ──
  els.btnOpenPreferences?.addEventListener("click", () => {
    if (globalThis.chrome?.runtime?.openOptionsPage) {
      globalThis.chrome.runtime.openOptionsPage();
      return;
    }

    globalThis.open("options.html", "_blank");
  });

  // ── Live preference sync (options page changes) ──
  if (globalThis.chrome?.storage?.onChanged) {
    globalThis.chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes[PREFERENCES_STORAGE_KEY]) return;

      refreshPreferencesFromStorage().catch(err => {
        console.error("Failed to refresh preferences:", err);
      });
    });
  } else {
    globalThis.addEventListener("storage", event => {
      if (![PREFERENCES_STORAGE_KEY, "sourceTz"].includes(event.key)) return;

      refreshPreferencesFromStorage().catch(err => {
        console.error("Failed to refresh preferences:", err);
      });
    });
  }

  // ── Focus input on open ──
  els.input.focus();

  // ── Handle paste shortcut: if clipboard has a time-like string, auto-populate ──
  document.addEventListener("keydown", e => {
    // Cmd/Ctrl+V when input is already focused is handled natively
    // This catches cases where user focuses the popup and pastes before clicking input
    if ((e.metaKey || e.ctrlKey) && e.key === "v" && document.activeElement !== els.input) {
      els.input.focus();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("Popup init failed:", err);
  });
});
