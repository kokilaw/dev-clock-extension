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

    queryProviderCombo: document.getElementById("queryProviderCombo"),
    queryProviderInput: document.getElementById("queryProviderInput"),
    queryProviderToggle: document.getElementById("queryProviderToggle"),
    queryProviderList: document.getElementById("queryProviderList"),

    btnAddTimezone: document.getElementById("btnAddTimezone"),
    sourceTimezoneChips: document.getElementById("sourceTimezoneChips"),
    hourFormatRadios: document.querySelectorAll('input[name="hourFormat"]'),
    queryWindowSelect: document.getElementById("queryWindowSelect"),
    btnSave: document.getElementById("btnSave"),
    btnReset: document.getElementById("btnReset"),
    status: document.getElementById("status"),
    privacyPolicyLink: document.getElementById("privacyPolicyLink"),
  };

  const PRIVACY_POLICY_URL = "https://kokilaw.github.io/dev-clock-extension/privacy-policy.html";

  const LOCKED_TIMEZONES = new Set(["LOCAL"]);

  let currentPrefs = null;
  let timezoneOptions = [];
  let activeComboKey = null;

  const PROVIDER_OPTIONS = {
    splunk: "Splunk",
    grafana: "Grafana",
    cloudwatch: "CloudWatch",
    datadog: "Datadog",
    kibana: "Kibana",
  };

  const comboState = {
    local: { highlightedIndex: -1 },
    add: { highlightedIndex: -1 },
    provider: { highlightedIndex: -1 },
  };

  const comboConfig = {
    add: {
      key: "add",
      includeLocal: true,
      mode: "timezone",
      comboEl: () => els.timezoneToAddCombo,
      inputEl: () => els.timezoneToAddInput,
      listEl: () => els.timezoneToAddList,
      toggleEl: () => els.timezoneToAddToggle,
    },
    local: {
      key: "local",
      includeLocal: false,
      mode: "timezone",
      comboEl: () => els.localTimezoneCombo,
      inputEl: () => els.localTimezoneInput,
      listEl: () => els.localTimezoneList,
      toggleEl: () => els.localTimezoneToggle,
    },
    provider: {
      key: "provider",
      includeLocal: false,
      mode: "provider",
      comboEl: () => els.queryProviderCombo,
      inputEl: () => els.queryProviderInput,
      listEl: () => els.queryProviderList,
      toggleEl: () => els.queryProviderToggle,
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

  function normalizeOffsetLabel(rawOffset) {
    if (!rawOffset || rawOffset === "UTC" || rawOffset === "GMT") return "UTC+00:00";

    const match = rawOffset.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return rawOffset.replace("GMT", "UTC");

    const [, sign, h, m = "00"] = match;
    return `UTC${sign}${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  }

  function getOffsetLabelForZone(zone) {
    const effectiveZone = zone === "LOCAL"
      ? (currentPrefs?.localTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC")
      : zone;

    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: effectiveZone,
        timeZoneName: "shortOffset",
      }).formatToParts(new Date());

      const tzPart = parts.find(p => p.type === "timeZoneName")?.value;
      return normalizeOffsetLabel(tzPart || "UTC");
    } catch {
      return "UTC+00:00";
    }
  }

  function getTimezoneOptionLabel(zone) {
    return `${zone} (${getOffsetLabelForZone(zone)})`;
  }

  function getProviderOptionLabel(provider) {
    return PROVIDER_OPTIONS[provider] || provider;
  }

  function getComboOptions(cfg) {
    if (cfg.mode === "provider") return Object.keys(PROVIDER_OPTIONS);
    return getComboboxOptions(cfg.includeLocal);
  }

  function getComboOptionLabel(cfg, value) {
    if (cfg.mode === "provider") return getProviderOptionLabel(value);
    return getTimezoneOptionLabel(value);
  }

  function filterComboboxOptions(cfg, options, query) {
    const normalized = (query || "").trim().toLowerCase();
    if (!normalized) return options;

    return options.filter(value => {
      const label = getComboOptionLabel(cfg, value).toLowerCase();
      return value.toLowerCase().includes(normalized) || label.includes(normalized);
    });
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

    const allOptions = getComboOptions(cfg);
    const filtered = filterComboboxOptions(cfg, allOptions, inputEl.value);

    listEl.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("li");
      empty.className = "combo-item empty";
      empty.textContent = cfg.mode === "provider" ? "No matching provider" : "No matching timezone";
      listEl.appendChild(empty);
      return;
    }

    if (state.highlightedIndex >= filtered.length) {
      state.highlightedIndex = filtered.length - 1;
    }

    filtered.forEach((value, index) => {
      const li = document.createElement("li");
      const isActive = index === state.highlightedIndex || (!inputEl.value && index === 0 && state.highlightedIndex === -1);
      li.className = `combo-item${isActive ? " active" : ""}`;
      li.dataset.value = value;
      li.textContent = getComboOptionLabel(cfg, value);

      li.addEventListener("mousedown", event => {
        event.preventDefault();
        if (cfg.mode === "provider") {
          inputEl.value = getProviderOptionLabel(value);
          inputEl.dataset.value = value;
        } else {
          inputEl.value = value;
        }
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
    const value = active.dataset.value;
    if (cfg.mode === "provider") {
      cfg.inputEl().value = getProviderOptionLabel(value);
      cfg.inputEl().dataset.value = value;
    } else {
      cfg.inputEl().value = value;
    }
    closeAllCombos();
    return true;
  }

  function moveHighlight(comboKey, delta) {
    const cfg = comboConfig[comboKey];
    const inputEl = cfg.inputEl();
    const state = comboState[comboKey];
    const options = filterComboboxOptions(cfg, getComboOptions(cfg), inputEl.value);
    if (!options.length) return;

    const next = Math.max(0, Math.min(options.length - 1, state.highlightedIndex + delta));
    state.highlightedIndex = next;
    renderCombo(comboKey);
  }

  let dragSrcZone = null;

  function renderTimezoneChips() {
    els.sourceTimezoneChips.innerHTML = "";

    for (const zone of currentPrefs.sourceTimezones) {
      const chip = document.createElement("span");
      chip.className = `chip${LOCKED_TIMEZONES.has(zone) ? " locked" : ""}`;
      chip.dataset.zone = zone;
      chip.draggable = true;
      chip.innerHTML = `
        <span class="chip-drag-handle" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="chip-label">${zone}</span>
        <button type="button" aria-label="Remove ${zone}">✕</button>
      `;

      const removeBtn = chip.querySelector("button");
      if (removeBtn && !LOCKED_TIMEZONES.has(zone)) {
        removeBtn.addEventListener("click", () => {
          currentPrefs.sourceTimezones = currentPrefs.sourceTimezones.filter(z => z !== zone);
          if (currentPrefs.activeSourceTimezone === zone) {
            currentPrefs.activeSourceTimezone = currentPrefs.sourceTimezones[0] || "LOCAL";
          }
          renderTimezoneChips();
        });
      }

      chip.addEventListener("dragstart", e => {
        dragSrcZone = zone;
        chip.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      chip.addEventListener("dragend", () => {
        dragSrcZone = null;
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("dragging", "drag-over"));
      });

      chip.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragSrcZone && dragSrcZone !== zone) {
          chip.classList.add("drag-over");
        }
      });

      chip.addEventListener("dragleave", () => {
        chip.classList.remove("drag-over");
      });

      chip.addEventListener("drop", e => {
        e.preventDefault();
        chip.classList.remove("drag-over");
        if (!dragSrcZone || dragSrcZone === zone) return;

        const zones = currentPrefs.sourceTimezones;
        const fromIdx = zones.indexOf(dragSrcZone);
        const toIdx = zones.indexOf(zone);
        if (fromIdx === -1 || toIdx === -1) return;

        zones.splice(fromIdx, 1);
        zones.splice(toIdx, 0, dragSrcZone);
        renderTimezoneChips();
      });

      els.sourceTimezoneChips.appendChild(chip);
    }
  }

  function renderFormFromPrefs() {
    els.localTimezoneInput.value = currentPrefs.localTimezone;
    els.queryProviderInput.value = getProviderOptionLabel(currentPrefs.queryProvider);
    els.queryProviderInput.dataset.value = currentPrefs.queryProvider;

    els.hourFormatRadios.forEach(r => {
      r.checked = r.value === currentPrefs.hourFormat;
    });

    if (els.queryWindowSelect) {
      els.queryWindowSelect.value = String(currentPrefs.queryWindowSeconds || 60);
    }

    renderTimezoneChips();
  }

  function collectFormPatch() {
    const selectedHour = [...els.hourFormatRadios].find(r => r.checked)?.value || "24h";

    return {
      localTimezone: els.localTimezoneInput.value.trim(),
      queryProvider: els.queryProviderInput.dataset.value || currentPrefs.queryProvider,
      hourFormat: selectedHour,
      queryWindowSeconds: Number(els.queryWindowSelect?.value || 60),
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
    bindCombo("provider");

    document.addEventListener("click", event => {
      if (els.localTimezoneCombo.contains(event.target)) return;
      if (els.timezoneToAddCombo.contains(event.target)) return;
      if (els.queryProviderCombo.contains(event.target)) return;
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

      if (!PROVIDER_OPTIONS[patch.queryProvider]) {
        setStatus("Invalid provider selection", "err");
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
    if (els.privacyPolicyLink) {
      els.privacyPolicyLink.href = PRIVACY_POLICY_URL;
    }
    try {
      wireEvents();
      await load();
    } catch (err) {
      console.error(err);
      setStatus("Failed to load preferences.", "err");
    }
  });
})(globalThis);
