const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');
const {
  setWorldConstructor,
  Before,
  After,
  BeforeAll,
  AfterAll,
} = require('@cucumber/cucumber');

const popupFile = path.resolve(__dirname, '../../../dist/converter-popup.html');
const popupUrl = pathToFileURL(popupFile).href;

let browser;

class PopupWorld {
  constructor() {
    this.context = null;
    this.page = null;
  }
}

setWorldConstructor(PopupWorld);

BeforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

AfterAll(async () => {
  await browser?.close();
});

Before(async function () {
  this.context = await browser.newContext();
  this.page = await this.context.newPage();

  await this.page.addInitScript(() => {
    const key = 'devClockPreferences';
    const defaults = {
      schemaVersion: 1,
      localTimezone: 'Australia/Melbourne',
      sourceTimezones: ['America/New_York', 'UTC', 'Europe/London', 'LOCAL'],
      activeSourceTimezone: 'America/New_York',
      queryProvider: 'splunk',
      hourFormat: '24h',
    };

    const current = (() => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    const merged = { ...defaults, ...(current || {}) };
    localStorage.setItem(key, JSON.stringify(merged));
  });

  await this.page.goto(popupUrl);
  await this.page.waitForSelector('#timeInput');
});

After(async function () {
  await this.context?.close();
});
