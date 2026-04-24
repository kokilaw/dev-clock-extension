const { Given, When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

const TZ_SELECTORS = {
  'US/Eastern': '#tz-us',
  UTC: '#tz-utc',
  'UK/London': '#tz-uk',
  Local: '#tz-local',
};

Given('I open the LogTime Sync popup', async function () {
  await expect(this.page.locator('#timeInput')).toBeVisible();
});

When('I enter the timestamp {string}', async function (timestamp) {
  await this.page.locator('#timeInput').fill(timestamp);
});

When('I select the source timezone {string}', async function (timezone) {
  const selector = TZ_SELECTORS[timezone];
  if (!selector) {
    throw new Error(`Unsupported timezone in test step: ${timezone}`);
  }
  await this.page.locator(selector).click();
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

Then('the result card should be visible', async function () {
  await expect(this.page.locator('#resultCard')).toHaveClass(/visible/);
});

Then('the parse error should be visible', async function () {
  await expect(this.page.locator('#errorMsg')).toHaveClass(/visible/);
});

Then('the parse error should not be visible', async function () {
  await expect(this.page.locator('#errorMsg')).not.toHaveClass(/visible/);
});

Then('the converted ISO should match the datetime pattern', async function () {
  await expect(this.page.locator('#resultISO')).toHaveText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}/);
});

Then('the Splunk copy button should be enabled', async function () {
  await expect(this.page.locator('#btnSplunk')).toBeEnabled();
});

Then('the Splunk copy button should be disabled', async function () {
  await expect(this.page.locator('#btnSplunk')).toBeDisabled();
});

Then('the time copy button should be disabled', async function () {
  await expect(this.page.locator('#btnCopy')).toBeDisabled();
});

Then('the copy action buttons should be enabled', async function () {
  await expect(this.page.locator('#btnSplunk')).toBeEnabled();
  await expect(this.page.locator('#btnCopy')).toBeEnabled();
});
