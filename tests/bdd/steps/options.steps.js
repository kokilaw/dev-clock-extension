const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

function getOptionsUrlFromCurrent(page) {
  return page.url().replace('converter-popup.html', 'options.html');
}

Given('I open the options page', async function () {
  await this.page.goto(getOptionsUrlFromCurrent(this.page));
  await expect(this.page.locator('#localTimezoneInput')).toBeVisible();
});

When('I reload the options page', async function () {
  await this.page.reload();
  await this.page.waitForSelector('#localTimezoneInput');
});

When('I open the local timezone dropdown', async function () {
  await this.page.locator('#localTimezoneToggle').click();
  await this.page.locator('#localTimezoneInput').fill('');
  await expect(this.page.locator('#localTimezoneCombo')).toHaveClass(/open/);
});

When('I open the provider dropdown', async function () {
  await this.page.locator('#queryProviderToggle').click();
  await this.page.locator('#queryProviderInput').fill('');
  await expect(this.page.locator('#queryProviderCombo')).toHaveClass(/open/);
});

When('I select local timezone option {string}', async function (zone) {
  await this.page.locator('#localTimezoneInput').fill(zone);
  await this.page.locator('#localTimezoneInput').press('ArrowDown');
  await this.page.locator('#localTimezoneInput').press('Enter');
});

When('I select provider option {string}', async function (provider) {
  await this.page.locator('#queryProviderInput').fill(provider);
  await this.page.locator('#queryProviderInput').press('ArrowDown');
  await this.page.locator('#queryProviderInput').press('Enter');
});

When('I type {string} in the add timezone field', async function (zone) {
  await this.page.locator('#timezoneToAddInput').fill(zone);
});

When('I click add timezone', async function () {
  await this.page.locator('#btnAddTimezone').click();
});

When('I choose hour format {string} in options', async function (hourFormat) {
  await this.page.locator(`input[name="hourFormat"][value="${hourFormat}"]`).check();
});

When('I save options preferences', async function () {
  await this.page.locator('#btnSave').click();
});

Then('the timezone option {string} should include an offset label', async function (zone) {
  const option = this.page.locator(`#localTimezoneList .combo-item[data-value="${zone}"]`).first();
  await expect(option).toBeVisible();
  await expect(option).toHaveText(new RegExp(`^${zone.replace('/', '\\/')} \\(UTC[+-]\\d{2}:\\d{2}\\)$`));
});

Then('the provider option {string} should be visible in the combo list', async function (provider) {
  const option = this.page.locator(`#queryProviderList .combo-item[data-value="${provider}"]`).first();
  await expect(option).toBeVisible();
});

Then('options status should be {string}', async function (message) {
  await expect(this.page.locator('#status')).toHaveText(message);
});

Then('options status should contain {string}', async function (message) {
  await expect(this.page.locator('#status')).toContainText(message);
});

Then('source timezone chip {string} should be visible in options', async function (zone) {
  await expect(this.page.locator(`#sourceTimezoneChips .chip[data-zone="${zone}"]`)).toBeVisible();
});

Then('source timezone chip {string} should not be visible in options', async function (zone) {
  await expect(this.page.locator(`#sourceTimezoneChips .chip[data-zone="${zone}"]`)).toHaveCount(0);
});

Then('the saved local timezone should be {string}', async function (zone) {
  const saved = await this.page.evaluate(() => {
    const raw = localStorage.getItem('devClockPreferences');
    return raw ? JSON.parse(raw).localTimezone : null;
  });
  expect(saved).toBe(zone);
});

Then('the saved query provider should be {string}', async function (provider) {
  const saved = await this.page.evaluate(() => {
    const raw = localStorage.getItem('devClockPreferences');
    return raw ? JSON.parse(raw).queryProvider : null;
  });
  expect(saved).toBe(provider);
});

Then('the saved hour format should be {string}', async function (hourFormat) {
  const saved = await this.page.evaluate(() => {
    const raw = localStorage.getItem('devClockPreferences');
    return raw ? JSON.parse(raw).hourFormat : null;
  });
  expect(saved).toBe(hourFormat);
});

Then('the local timezone input should be {string}', async function (zone) {
  await expect(this.page.locator('#localTimezoneInput')).toHaveValue(zone);
});

Then('the provider input should be {string}', async function (value) {
  await expect(this.page.locator('#queryProviderInput')).toHaveValue(value);
});

Then('the options hour format should be {string}', async function (hourFormat) {
  await expect(this.page.locator(`input[name="hourFormat"][value="${hourFormat}"]`)).toBeChecked();
});
