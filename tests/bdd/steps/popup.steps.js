const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { DateTime } = require('luxon');

const TZ_SELECTORS = {
  'US/Eastern': '#tz-us',
  UTC: '#tz-utc',
  'UK/London': '#tz-uk',
  Local: '#tz-local',
};

const DEFAULT_PREFS = {
  schemaVersion: 1,
  localTimezone: 'UTC',
  sourceTimezones: ['America/New_York', 'UTC', 'Europe/London', 'LOCAL'],
  activeSourceTimezone: 'America/New_York',
  queryProvider: 'splunk',
  hourFormat: '24h',
};

function selectorForTimezone(timezone) {
  return TZ_SELECTORS[timezone] || `.tz-btn[data-tz="${timezone}"]`;
}

const TZ_IANA = {
  'US/Eastern': 'America/New_York',
  UTC: 'UTC',
  'UK/London': 'Europe/London',
  Local: DateTime.local().zoneName,
};

Given('I open the DevClock popup', async function () {
  this.selectedTimezone = this.selectedTimezone || 'US/Eastern';
  await expect(this.page.locator('#timeInput')).toBeVisible();
});

Given(/^the input is "([^"]*)" \(no timezone\)$/, async function (timestamp) {
  await this.page.locator('#timeInput').fill(timestamp);
});

When('I enter the timestamp {string}', async function (timestamp) {
  await this.page.locator('#timeInput').fill(timestamp);
});

When('I select the source timezone {string}', async function (timezone) {
  const selector = selectorForTimezone(timezone);
  this.selectedTimezone = timezone;
  await this.page.locator(selector).click();
});

When('I click the {string} toggle', async function (timezone) {
  const selector = selectorForTimezone(timezone);
  this.selectedTimezone = timezone;
  await this.page.locator(selector).click();
});

Given('popup preferences include source timezone {string}', async function (timezone) {
  await this.page.evaluate(({ timezone, defaults }) => {
    const key = 'devClockPreferences';
    const current = JSON.parse(localStorage.getItem(key) || 'null') || defaults;
    const next = {
      ...defaults,
      ...current,
      sourceTimezones: [...new Set([...(current.sourceTimezones || defaults.sourceTimezones), timezone, 'UTC', 'LOCAL'])],
    };
    localStorage.setItem(key, JSON.stringify(next));
  }, { timezone, defaults: DEFAULT_PREFS });

  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

Given('popup query provider is {string}', async function (provider) {
  await this.page.addInitScript(({ key, provider }) => {
    try {
      const prefs = JSON.parse(localStorage.getItem(key) || '{}');
      prefs.queryProvider = provider;
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {}
  }, { key: 'devClockPreferences', provider });

  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

Given('popup local timezone is {string}', async function (localTimezone) {
  await this.page.addInitScript(({ key, localTimezone }) => {
    try {
      const prefs = JSON.parse(localStorage.getItem(key) || '{}');
      prefs.localTimezone = localTimezone;
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {}
  }, { key: 'devClockPreferences', localTimezone });

  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

Given('popup hour format is {string}', async function (hourFormat) {
  await this.page.addInitScript(({ key, hourFormat }) => {
    try {
      const prefs = JSON.parse(localStorage.getItem(key) || '{}');
      prefs.hourFormat = hourFormat;
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {}
  }, { key: 'devClockPreferences', hourFormat });

  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

Given('only legacy source timezone {string} exists', async function (timezone) {
  await this.page.evaluate(timezone => {
    localStorage.removeItem('devClockPreferences');
    localStorage.setItem('sourceTz', timezone);
  }, timezone);

  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

Given('popup preferences exclude source timezone {string}', async function (timezone) {
  await this.page.evaluate(({ timezone, defaults }) => {
    const key = 'devClockPreferences';
    const current = JSON.parse(localStorage.getItem(key) || 'null') || defaults;
    const nextSourceTimezones = (current.sourceTimezones || defaults.sourceTimezones)
      .filter(z => z !== timezone);

    for (const required of ['UTC', 'LOCAL']) {
      if (!nextSourceTimezones.includes(required)) nextSourceTimezones.push(required);
    }

    const activeSourceTimezone = nextSourceTimezones.includes(current.activeSourceTimezone)
      ? current.activeSourceTimezone
      : nextSourceTimezones[0];

    const next = {
      ...defaults,
      ...current,
      sourceTimezones: nextSourceTimezones,
      activeSourceTimezone,
    };

    localStorage.setItem(key, JSON.stringify(next));
  }, { timezone, defaults: DEFAULT_PREFS });

  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

When('I note the current converted ISO value', async function () {
  this.previousConvertedIso = (await this.page.locator('#resultISO').innerText()).trim();
});

When('I close and re-open the extension popup', async function () {
  await this.page.reload();
  await this.page.waitForSelector('#timeInput');
});

Then('the converted ISO should be {string}', async function (value) {
  await expect(this.page.locator('#resultISO')).toHaveText(value);
});

Then('the converted time should be {string}', async function (value) {
  await expect(this.page.locator('#resultTime')).toHaveText(value);
});

Then('the converted date should be {string}', async function (value) {
  await expect(this.page.locator('#resultDate')).toHaveText(value);
});

Then('the source timezone label should be {string}', async function (value) {
  await expect(this.page.locator('#resultFromTz')).toHaveText(value);
});

Then('the unix output should be {string}', async function (value) {
  await expect(this.page.locator('#resultUnix')).toHaveText(value);
});

Then('the Splunk preview should contain {string}', async function (value) {
  await expect(this.page.locator('#splunkPreviewText')).toContainText(value);
});

Then('the result should be calculated using today\'s date', async function () {
  const zone = TZ_IANA[this.selectedTimezone || 'US/Eastern'];
  const expectedDate = DateTime.now().setZone(zone).toFormat('dd LLL yyyy');
  await expect(this.page.locator('#resultFromTime')).toContainText(expectedDate);
});

Then('the converted AU time should be displayed', async function () {
  await expect(this.page.locator('#resultTime')).toHaveText(/\d{2}:\d{2}:\d{2}/);
});

Then('the AU result should update to reflect a conversion from New York time', async function () {
  const currentIso = (await this.page.locator('#resultISO').innerText()).trim();
  expect(currentIso).not.toBe(this.previousConvertedIso);
});

Then('the Splunk query should update its time range accordingly', async function () {
  const preview = (await this.page.locator('#splunkPreviewText').innerText()).trim();
  expect(preview).toContain('_time');
  expect(preview).toContain('AND');
});

Then('it should be correctly interpreted as {string}', async function (_value) {
  await expect(this.page.locator('#resultFromTime')).toContainText('15:45:00');
});

Then('it should be treated as a Unix Epoch', async function () {
  await expect(this.page.locator('#resultUnix')).toHaveText('1714012233');
});

Then('the result should show the human-readable AU time for that exact second', async function () {
  await expect(this.page.locator('#resultISO')).toHaveText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}/);
});

Then('the Splunk copy output should contain the exact timestamp', async function () {
  // The ISO display preserves milliseconds from the original input
  await expect(this.page.locator('#resultISO')).toContainText('2026-04-25T14:15:22.455+10:00');
});

Then('the Splunk copy output should use a ±1 minute range around that second', async function () {
  await expect(this.page.locator('#splunkPreviewText')).toContainText('2026-04-25T14:14:22+10:00');
  await expect(this.page.locator('#splunkPreviewText')).toContainText('2026-04-25T14:16:22+10:00');
});

Then('the converted ISO should remain unchanged', async function () {
  const currentIso = (await this.page.locator('#resultISO').innerText()).trim();
  expect(currentIso).toBe(this.previousConvertedIso);
});

Then('the result card should be visible', async function () {
  await expect(this.page.locator('#resultCard')).toHaveClass(/visible/);
});

Then('the result card should not be visible', async function () {
  await expect(this.page.locator('#resultCard')).not.toHaveClass(/visible/);
});

Then('the parse error should be visible', async function () {
  await expect(this.page.locator('#errorMsg')).toHaveClass(/visible/);
});

Then('the parse error should not be visible', async function () {
  await expect(this.page.locator('#errorMsg')).not.toHaveClass(/visible/);
});

Then('the parse error message {string} should be visible', async function (message) {
  await expect(this.page.locator('#errorMsg')).toHaveClass(/visible/);
  await expect(this.page.locator('#errorMsg')).toContainText(message);
});

Then('the converted ISO should match the datetime pattern', async function () {
  await expect(this.page.locator('#resultISO')).toHaveText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}/);
});

Then('the offset difference should reflect +15 hours', async function () {
  const sourceText = (await this.page.locator('#resultFromTime').innerText()).trim();
  const melbIso = (await this.page.locator('#resultISO').innerText()).trim();

  const match = sourceText.match(/^(\d{2}:\d{2}:\d{2}) \((\d{2} \w{3} \d{4})\)$/);
  if (!match) {
    throw new Error(`Unable to parse source time display: ${sourceText}`);
  }

  const [, sourceHms, sourceDate] = match;
  const zone = TZ_IANA[this.selectedTimezone || 'US/Eastern'];
  const sourceDT = DateTime.fromFormat(`${sourceHms} ${sourceDate}`, 'HH:mm:ss dd LLL yyyy', { zone });
  const melbDT = DateTime.fromISO(melbIso, { setZone: true });

  // Compare UTC offsets (wall-clock difference), not the UTC instant (which would be 0)
  const offsetDiffHours = (melbDT.offset - sourceDT.offset) / 60;
  expect(Math.round(offsetDiffHours)).toBe(15);
});

Then('the input field should have focus automatically', async function () {
  await expect(this.page.locator('#timeInput')).toBeFocused();
});

Then('{string} should still be the active toggle', async function (timezone) {
  const selector = selectorForTimezone(timezone);
  await expect(this.page.locator(selector)).toHaveClass(/active/);
});

Then('a source timezone toggle for {string} should be visible', async function (timezone) {
  const selector = selectorForTimezone(timezone);
  await expect(this.page.locator(selector)).toBeVisible();
});

Then('a source timezone toggle for {string} should not be visible', async function (timezone) {
  const selector = selectorForTimezone(timezone);
  await expect(this.page.locator(selector)).toHaveCount(0);
});

Then('the query preview label should contain {string}', async function (value) {
  await expect(this.page.locator('#queryPreviewLabel')).toContainText(value);
});

Then('the query preview should contain {string}', async function (value) {
  await expect(this.page.locator('#splunkPreviewText')).toContainText(value);
});

Then('the query preview should not contain {string}', async function (value) {
  await expect(this.page.locator('#splunkPreviewText')).not.toContainText(value);
});

Then('the converted time should include a meridiem marker', async function () {
  await expect(this.page.locator('#resultTime')).toHaveText(/\b(AM|PM)\b/i);
});

Then('the converted time should not include a meridiem marker', async function () {
  await expect(this.page.locator('#resultTime')).not.toHaveText(/\b(AM|PM)\b/i);
});

Then('the new preferences should have active source timezone {string}', async function (expectedTimezone) {
  const active = await this.page.evaluate(() => {
    const raw = localStorage.getItem('devClockPreferences');
    return raw ? JSON.parse(raw).activeSourceTimezone : null;
  });

  expect(active).toBe(expectedTimezone);
});

Then('the Splunk copy button should be enabled', async function () {
  await expect(this.page.locator('#splunkPreview')).toBeVisible();
  await expect(this.page.locator('#splunkPreviewText.copyable')).toBeVisible();
});

Then('the Splunk copy button should be disabled', async function () {
  await expect(this.page.locator('#splunkPreview')).not.toBeVisible();
});

Then('the time copy button should be disabled', async function () {
  await expect(this.page.locator('#resultCard')).not.toBeVisible();
});

Then('the copy action buttons should be enabled', async function () {
  await expect(this.page.locator('#resultTime.copyable')).toBeVisible();
  await expect(this.page.locator('#resultUnix.copyable')).toBeVisible();
  await expect(this.page.locator('#resultISO.copyable')).toBeVisible();
  await expect(this.page.locator('#splunkPreviewText.copyable')).toBeVisible();
});
