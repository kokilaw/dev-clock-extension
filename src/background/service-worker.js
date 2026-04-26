"use strict";

const CONTEXT_MENU_ID = "devclock-convert-selection";
const PENDING_INPUT_STORAGE_KEY = "devClockPendingInput";

function createSelectionMenu() {
  chrome.contextMenus.create(
    {
      id: CONTEXT_MENU_ID,
      title: "Convert time with DevClock",
      contexts: ["selection"],
    },
    () => {
      const err = chrome.runtime.lastError;
      if (!err) return;

      if (!String(err.message || "").toLowerCase().includes("duplicate")) {
        console.warn("Failed to create context menu:", err.message);
      }
    }
  );
}

function setPendingInput(value) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [PENDING_INPUT_STORAGE_KEY]: value }, () => resolve());
  });
}

function openDevClockPopupOrTab() {
  const popupApi = chrome.action?.openPopup;

  if (typeof popupApi === "function") {
    try {
      const maybePromise = popupApi();
      if (maybePromise && typeof maybePromise.then === "function") {
        return maybePromise.catch(() => {
          chrome.tabs.create({ url: chrome.runtime.getURL("converter-popup.html") });
        });
      }
      return Promise.resolve();
    } catch {
      // Fall through to tab fallback below.
    }
  }

  chrome.tabs.create({ url: chrome.runtime.getURL("converter-popup.html") });
  return Promise.resolve();
}

chrome.runtime.onInstalled.addListener(() => {
  createSelectionMenu();
});

chrome.runtime.onStartup.addListener(() => {
  createSelectionMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const selectedText = (info.selectionText || "").trim();
  if (!selectedText) return;

  setPendingInput(selectedText)
    .then(() => openDevClockPopupOrTab())
    .catch(err => {
      console.error("Failed to pass selected text to DevClock:", err);
    });
});
