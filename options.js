"use strict";

(function initOptionsPage(global) {
  const prefsApi = global.DevClockPreferences;

  if (!prefsApi) {
    console.error("DevClockPreferences module not loaded");
    return;
  }

  const els = {
    localTimezoneSearch: document.getElementById("localTimezoneSearch"),
    localTimezone: document.getElementById("localTimezone"),
    timezoneToAddSearch: document.getElementById("timezoneToAddSearch"),
    timezoneToAdd: document.getElementById("timezoneToAdd"),
    btnAddTimezone: document.getElementById("btnAddTimezone"),
    sourceTimezoneChips: document.getElementById("sourceTimezoneChips"),
    queryProvider: document.getElementById("queryProvider"),
    hourFormatRadios: document.querySelectorAll('input[name="hourFormat"]'),
    btnSave: document.getElementById("btnSave"),
    btnReset: document.getElementById("btnReset"),
    status: document.getElementById("status"),
  };

  const LOCKED_TIMEZONES = new Set(["UTC", "LOCAL"]);

  let currentPrefs = null;
  let timezoneOptions = [];

  function setStatus(message, type = "ok") {
    els.status.textContent = message;
    els.status.classList.remove("ok", "err");
    els.status.classList.add(type === "err" ? "err" : "ok");
  }

  function getTimezoneOptions() {
    if (typeof Intl.supportedValuesOf === "function") {
      try {
        return Intl.supportedValuesOf("timeZone");
      } catch {
        // fall through
      }
    }

    return [
      "UTC",
      "Australia/Melbourne",
      "America/New_York",
      "Europe/London",
      "Asia/Singapore",
      "Asia/Kolkata",
      "Europe/Berlin",
      "America/Los_Angeles",
    ];
  }

  function fillSelectWithTimezones(selectEl, zones, includeLocal = false) {
    const options = includeLocal ? ["LOCAL", ...zones] : zones;
    const previousValue = selectEl.value;

    selectEl.innerHTML = "";
    for (const zone of options) {
      const option = document.createElement("option");
      option.value = zone;
      option.textContent = zone;
      selectEl.appendChild(option);
    }

    if (previousValue && options.includes(previousValue)) {
      selectEl.value = previousValue;
    }
  }

  function filterTimezones(query) {
    const normalized = (query || "").trim().toLowerCase();
    if (!normalized) return timezoneOptions;
    return timezoneOptions.filter(zone => zone.toLowerCase().includes(normalized));
  }

  function refreshTimezoneSelects() {
    const localZones = filterTimezones(els.localTimezoneSearch?.value);
    const addZones = filterTimezones(els.timezoneToAddSearch?.value);

    fillSelectWithTimezones(els.localTimezone, localZones, false);
    fillSelectWithTimezones(els.timezoneToAdd, addZones, true);
  }

  function renderTimezoneChips() {
    els.sourceTimezoneChips.innerHTML = "";

    for (const zone of currentPrefs.sourceTimezones) {
      const chip = document.createElement("span");
      chip.className = `chip${LOCKED_TIMEZONES.has(zone) ? " locked" : ""}`;
      chip.dataset.zone = zone;
      chip.innerHTML = `<span>${zone}</span><button type="button" aria-label="Remove ${zone}">✕</button>`;

      const removeBtn = chip.querySelector("button");
      if (removeBtn && !LOCKED_TIMEZONES.has(zone)) {
        removeBtn.addEventListener("click", () => {
          currentPrefs.sourceTimezones = currentPrefs.sourceTimezones.filter(z => z !== zone);
          if (currentPrefs.activeSourceTimezone === zone) {
            currentPrefs.activeSourceTimezone = currentPrefs.sourceTimezones[0] || "UTC";
          }
          renderTimezoneChips();
        });
      }

      els.sourceTimezoneChips.appendChild(chip);
    }
  }

  function renderFormFromPrefs() {
    els.localTimezone.value = currentPrefs.localTimezone;
    els.queryProvider.value = currentPrefs.queryProvider;

    els.hourFormatRadios.forEach(r => {
      r.checked = r.value === currentPrefs.hourFormat;
    });

    renderTimezoneChips();
  }

  function collectFormPatch() {
    const selectedHour = [...els.hourFormatRadios].find(r => r.checked)?.value || "24h";

    return {
      localTimezone: els.localTimezone.value,
      queryProvider: els.queryProvider.value,
      hourFormat: selectedHour,
      sourceTimezones: currentPrefs.sourceTimezones,
      activeSourceTimezone: currentPrefs.activeSourceTimezone,
    };
  }

  async function load() {
    timezoneOptions = getTimezoneOptions();
    refreshTimezoneSelects();

    currentPrefs = await prefsApi.getPreferences();
    renderFormFromPrefs();
    setStatus("Loaded current preferences.");
  }

  function wireEvents() {
    els.btnAddTimezone.addEventListener("click", () => {
      const zone = els.timezoneToAdd.value;
      if (!zone) return;

      if (!currentPrefs.sourceTimezones.includes(zone)) {
        currentPrefs.sourceTimezones.push(zone);
        renderTimezoneChips();
        setStatus(`Added ${zone}.`);
      } else {
        setStatus(`${zone} is already in the list.`, "err");
      }
    });

    els.localTimezoneSearch?.addEventListener("input", () => {
      const selected = els.localTimezone.value;
      refreshTimezoneSelects();
      if (selected) els.localTimezone.value = selected;
    });

    els.timezoneToAddSearch?.addEventListener("input", () => {
      refreshTimezoneSelects();
    });

    els.btnSave.addEventListener("click", async () => {
      const patch = collectFormPatch();
      currentPrefs = await prefsApi.savePreferences(patch);
      renderFormFromPrefs();
      setStatus("Preferences saved.");
    });

    els.btnReset.addEventListener("click", async () => {
      currentPrefs = await prefsApi.resetPreferences();
      renderFormFromPrefs();
      setStatus("Preferences reset to defaults.");
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      wireEvents();
      await load();
    } catch (err) {
      console.error(err);
      setStatus("Failed to load preferences.", "err");
    }
  });
})(globalThis);
