"use strict";

(function initOptionsPage(global) {
  const prefsApi = global.DevClockPreferences;

  if (!prefsApi) {
    console.error("DevClockPreferences module not loaded");
    return;
  }

  const els = {
    localTimezoneCombo: document.getElementById("localTimezoneCombo"),
    localTimezoneInput: document.getElementById("localTimezoneInput"),
    localTimezoneToggle: document.getElementById("localTimezoneToggle"),
    localTimezoneList: document.getElementById("localTimezoneList"),

    timezoneToAddCombo: document.getElementById("timezoneToAddCombo"),
    timezoneToAddInput: document.getElementById("timezoneToAddInput"),
    timezoneToAddToggle: document.getElementById("timezoneToAddToggle"),
    timezoneToAddList: document.getElementById("timezoneToAddList"),

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
  let activeComboKey = null;

  const comboState = {
    local: { highlightedIndex: -1 },
    add: { highlightedIndex: -1 },
  };

  const comboConfig = {
    local: {
      key: "local",
      includeLocal: false,
      comboEl: () => els.localTimezoneCombo,
      inputEl: () => els.localTimezoneInput,
      listEl: () => els.localTimezoneList,
      toggleEl: () => els.localTimezoneToggle,
    },
    add: {
      key: "add",
      includeLocal: true,
      comboEl: () => els.timezoneToAddCombo,
      inputEl: () => els.timezoneToAddInput,
      listEl: () => els.timezoneToAddList,
      toggleEl: () => els.timezoneToAddToggle,
    },
  };

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

  function getComboboxOptions(includeLocal = false) {
    return includeLocal ? ["LOCAL", ...timezoneOptions] : timezoneOptions;
  }

  function filterComboboxOptions(options, query) {
    const normalized = (query || "").trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(zone => zone.toLowerCase().includes(normalized));
  }

  function isValidTimezone(zone, allowLocal = false) {
    if (typeof zone !== "string" || !zone.trim()) return false;
    if (allowLocal && zone === "LOCAL") return true;

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }

  function closeAllCombos() {
    Object.values(comboConfig).forEach(cfg => {
      cfg.comboEl().classList.remove("open");
      comboState[cfg.key].highlightedIndex = -1;
    });
    activeComboKey = null;
  }

  function renderCombo(comboKey) {
    const cfg = comboConfig[comboKey];
    const inputEl = cfg.inputEl();
    const listEl = cfg.listEl();
    const state = comboState[comboKey];

    const allOptions = getComboboxOptions(cfg.includeLocal);
    const filtered = filterComboboxOptions(allOptions, inputEl.value);

    listEl.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "combo-item empty";
      empty.textContent = "No matching timezone";
      listEl.appendChild(empty);
      return;
    }

    if (state.highlightedIndex >= filtered.length) {
      state.highlightedIndex = filtered.length - 1;
    }

    filtered.forEach((zone, index) => {
      const li = document.createElement("li");
      const isActive = index === state.highlightedIndex || (!inputEl.value && index === 0 && state.highlightedIndex === -1);
      li.className = `combo-item${isActive ? " active" : ""}`;
      li.dataset.zone = zone;
      li.textContent = zone;

      li.addEventListener("mousedown", event => {
        event.preventDefault();
        inputEl.value = zone;
        closeAllCombos();
      });

      listEl.appendChild(li);
    });
  }

  function openCombo(comboKey) {
    if (activeComboKey && activeComboKey !== comboKey) {
      closeAllCombos();
    }

    const cfg = comboConfig[comboKey];
    cfg.comboEl().classList.add("open");
    activeComboKey = comboKey;
    renderCombo(comboKey);
  }

  function selectHighlighted(comboKey) {
    const cfg = comboConfig[comboKey];
    const listEl = cfg.listEl();
    const active = listEl.querySelector(".combo-item.active:not(.empty)");
    if (!active) return false;
    cfg.inputEl().value = active.dataset.zone;
    closeAllCombos();
    return true;
  }

  function moveHighlight(comboKey, delta) {
    const cfg = comboConfig[comboKey];
    const inputEl = cfg.inputEl();
    const state = comboState[comboKey];
    const options = filterComboboxOptions(getComboboxOptions(cfg.includeLocal), inputEl.value);
    if (!options.length) return;

    const next = Math.max(0, Math.min(options.length - 1, state.highlightedIndex + delta));
    state.highlightedIndex = next;
    renderCombo(comboKey);
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
    els.localTimezoneInput.value = currentPrefs.localTimezone;
    els.queryProvider.value = currentPrefs.queryProvider;

    els.hourFormatRadios.forEach(r => {
      r.checked = r.value === currentPrefs.hourFormat;
    });

    renderTimezoneChips();
  }

  function collectFormPatch() {
    const selectedHour = [...els.hourFormatRadios].find(r => r.checked)?.value || "24h";

    return {
      localTimezone: els.localTimezoneInput.value.trim(),
      queryProvider: els.queryProvider.value,
      hourFormat: selectedHour,
      sourceTimezones: currentPrefs.sourceTimezones,
      activeSourceTimezone: currentPrefs.activeSourceTimezone,
    };
  }

  async function load() {
    timezoneOptions = getTimezoneOptions();

    currentPrefs = await prefsApi.getPreferences();
    renderFormFromPrefs();
    setStatus("Loaded current preferences.");
  }

  function wireEvents() {
    const bindCombo = (comboKey) => {
      const cfg = comboConfig[comboKey];
      const inputEl = cfg.inputEl();
      const toggleEl = cfg.toggleEl();

      inputEl.addEventListener("focus", () => openCombo(comboKey));

      inputEl.addEventListener("input", () => {
        comboState[comboKey].highlightedIndex = -1;
        openCombo(comboKey);
      });

      inputEl.addEventListener("keydown", event => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (!cfg.comboEl().classList.contains("open")) {
            openCombo(comboKey);
            return;
          }
          moveHighlight(comboKey, 1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          if (!cfg.comboEl().classList.contains("open")) {
            openCombo(comboKey);
            return;
          }
          moveHighlight(comboKey, -1);
        } else if (event.key === "Enter") {
          if (cfg.comboEl().classList.contains("open")) {
            event.preventDefault();
            selectHighlighted(comboKey);
          }
        } else if (event.key === "Escape") {
          closeAllCombos();
        }
      });

      toggleEl.addEventListener("click", () => {
        if (cfg.comboEl().classList.contains("open")) {
          closeAllCombos();
          return;
        }
        inputEl.focus();
        openCombo(comboKey);
      });
    };

    bindCombo("local");
    bindCombo("add");

    document.addEventListener("click", event => {
      if (els.localTimezoneCombo.contains(event.target)) return;
      if (els.timezoneToAddCombo.contains(event.target)) return;
      closeAllCombos();
    });

    els.btnAddTimezone.addEventListener("click", () => {
      const zone = els.timezoneToAddInput.value.trim();
      if (!zone) return;

      if (!isValidTimezone(zone, true)) {
        setStatus(`Invalid timezone: ${zone}`, "err");
        return;
      }

      if (!currentPrefs.sourceTimezones.includes(zone)) {
        currentPrefs.sourceTimezones.push(zone);
        renderTimezoneChips();
        setStatus(`Added ${zone}.`);
        els.timezoneToAddInput.value = "";
        comboState.add.highlightedIndex = -1;
        renderCombo("add");
      } else {
        setStatus(`${zone} is already in the list.`, "err");
      }
    });

    els.btnSave.addEventListener("click", async () => {
      const patch = collectFormPatch();

      if (!isValidTimezone(patch.localTimezone)) {
        setStatus(`Invalid timezone: ${patch.localTimezone}`, "err");
        return;
      }

      currentPrefs = await prefsApi.savePreferences(patch);
      renderFormFromPrefs();
      setStatus("Preferences saved.");
      closeAllCombos();
    });

    els.btnReset.addEventListener("click", async () => {
      currentPrefs = await prefsApi.resetPreferences();
      renderFormFromPrefs();
      setStatus("Preferences reset to defaults.");
      closeAllCombos();
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
