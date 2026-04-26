"use strict";

(function bootstrapPreferences(global) {
  const STORAGE_KEY = "devClockPreferences";
  const LEGACY_SOURCE_TZ_KEY = "sourceTz";
  const SCHEMA_VERSION = 1;

  const DEFAULTS = {
    schemaVersion: SCHEMA_VERSION,
    localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    sourceTimezones: ["UTC", "LOCAL"],
    activeSourceTimezone: "UTC",
    queryProvider: "splunk",
    hourFormat: "24h",
    queryWindowSeconds: 60,
  };

  function canUseChromeStorage() {
    return Boolean(global.chrome?.storage?.local);
  }

  function isValidTimezone(zone) {
    if (typeof zone !== "string" || !zone.trim()) return false;
    if (zone === "LOCAL") return true;

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }

  function sanitize(prefs) {
    const candidate = prefs && typeof prefs === "object" ? prefs : {};

    const sourceTimezones = [];
    for (const zone of Array.isArray(candidate.sourceTimezones) ? candidate.sourceTimezones : DEFAULTS.sourceTimezones) {
      if (!isValidTimezone(zone)) continue;
      if (!sourceTimezones.includes(zone)) sourceTimezones.push(zone);
    }

    for (const required of ["LOCAL"]) {
      if (!sourceTimezones.includes(required)) sourceTimezones.push(required);
    }

    const activeSourceTimezone =
      typeof candidate.activeSourceTimezone === "string" && sourceTimezones.includes(candidate.activeSourceTimezone)
        ? candidate.activeSourceTimezone
        : sourceTimezones.includes(DEFAULTS.activeSourceTimezone)
          ? DEFAULTS.activeSourceTimezone
          : sourceTimezones[0];

    const localTimezone = isValidTimezone(candidate.localTimezone) ? candidate.localTimezone : DEFAULTS.localTimezone;
    const queryProvider = ["splunk", "grafana", "cloudwatch"].includes(candidate.queryProvider)
      ? candidate.queryProvider
      : DEFAULTS.queryProvider;
    const hourFormat = ["12h", "24h"].includes(candidate.hourFormat) ? candidate.hourFormat : DEFAULTS.hourFormat;
    const VALID_WINDOW_SECONDS = [30, 60, 120, 300, 600, 1800];
    const queryWindowSeconds = VALID_WINDOW_SECONDS.includes(Number(candidate.queryWindowSeconds))
      ? Number(candidate.queryWindowSeconds)
      : DEFAULTS.queryWindowSeconds;

    return {
      schemaVersion: SCHEMA_VERSION,
      localTimezone,
      sourceTimezones,
      activeSourceTimezone,
      queryProvider,
      hourFormat,
      queryWindowSeconds,
    };
  }

  function readLocalStorageJson(key) {
    try {
      const raw = global.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocalStorageJson(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  function readLegacyTimezone() {
    try {
      const legacy = global.localStorage?.getItem(LEGACY_SOURCE_TZ_KEY);
      return isValidTimezone(legacy) ? legacy : null;
    } catch {
      return null;
    }
  }

  function clearLegacyTimezone() {
    try {
      global.localStorage?.removeItem(LEGACY_SOURCE_TZ_KEY);
    } catch {
      // ignore
    }
  }

  function readChromeStorage() {
    return new Promise(resolve => {
      global.chrome.storage.local.get([STORAGE_KEY], items => {
        if (global.chrome.runtime?.lastError) {
          resolve(null);
          return;
        }
        resolve(items?.[STORAGE_KEY] || null);
      });
    });
  }

  function writeChromeStorage(value) {
    return new Promise(resolve => {
      global.chrome.storage.local.set({ [STORAGE_KEY]: value }, () => resolve());
    });
  }

  async function readRaw() {
    if (canUseChromeStorage()) {
      const fromChrome = await readChromeStorage();
      if (fromChrome) return fromChrome;
    }
    return readLocalStorageJson(STORAGE_KEY);
  }

  async function writeRaw(value) {
    if (canUseChromeStorage()) {
      await writeChromeStorage(value);
      return;
    }
    writeLocalStorageJson(STORAGE_KEY, value);
  }

  async function getPreferences() {
    const raw = await readRaw();
    let prefs = sanitize(raw);

    const legacy = readLegacyTimezone();
    if (legacy) {
      if (!prefs.sourceTimezones.includes(legacy)) {
        prefs.sourceTimezones = [...prefs.sourceTimezones, legacy];
      }
      prefs.activeSourceTimezone = legacy;
      clearLegacyTimezone();
    }

    const shouldPersist = !raw || legacy || JSON.stringify(raw) !== JSON.stringify(prefs);
    if (shouldPersist) await writeRaw(prefs);

    return prefs;
  }

  async function savePreferences(patch) {
    const current = await getPreferences();
    const next = sanitize({ ...current, ...(patch || {}) });
    await writeRaw(next);
    return next;
  }

  async function resetPreferences() {
    const defaults = sanitize(DEFAULTS);
    await writeRaw(defaults);
    return defaults;
  }

  global.DevClockPreferences = {
    getPreferences,
    savePreferences,
    resetPreferences,
    getDefaultPreferences: () => sanitize(DEFAULTS),
  };
})(globalThis);
