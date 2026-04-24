const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

const popupFile = path.resolve(__dirname, '../../popup.html');
const popupUrl = pathToFileURL(popupFile).href;

async function openPopup(page) {
  await page.goto(popupUrl);
  await expect(page.locator('#timeInput')).toBeVisible();
}

test('converts ISO UTC input to Melbourne time', async ({ page }) => {
  await openPopup(page);
  await page.locator('#timeInput').fill('2024-06-10T14:30:00Z');

  await expect(page.locator('#resultISO')).toHaveText('2024-06-11T00:30:00+10:00');
  await expect(page.locator('#resultTime')).toHaveText('00:30:00');
  await expect(page.locator('#resultDate')).toHaveText('Tue, 11 Jun 2024');
  await expect(page.locator('#btnSplunk')).toBeEnabled();
  await expect(page.locator('#btnCopy')).toBeEnabled();
});

test('interprets naive ISO in selected source timezone', async ({ page }) => {
  await openPopup(page);
  await page.locator('#tz-utc').click();
  await page.locator('#timeInput').fill('2024-06-10T14:30:00');

  await expect(page.locator('#resultFromTz')).toHaveText('UTC');
  await expect(page.locator('#resultISO')).toHaveText('2024-06-11T00:30:00+10:00');
  await expect(page.locator('#splunkPreviewText')).toContainText('2024-06-11T00:29:00+10:00');
  await expect(page.locator('#splunkPreviewText')).toContainText('2024-06-11T00:31:00+10:00');
});

test('converts unix epoch seconds and shows Splunk fragment', async ({ page }) => {
  await openPopup(page);
  await page.locator('#timeInput').fill('1718000000');

  await expect(page.locator('#resultUnix')).toHaveText('1718000000');
  await expect(page.locator('#resultISO')).toHaveText('2024-06-10T16:13:20+10:00');
  await expect(page.locator('#splunkPreviewText')).toContainText('2024-06-10T16:12:20+10:00');
  await expect(page.locator('#splunkPreviewText')).toContainText('2024-06-10T16:14:20+10:00');
});

test('accepts natural-language timestamp input', async ({ page }) => {
  await openPopup(page);
  await page.locator('#timeInput').fill('yesterday at 5pm');

  await expect(page.locator('#errorMsg')).not.toHaveClass(/visible/);
  await expect(page.locator('#resultCard')).toHaveClass(/visible/);
  await expect(page.locator('#resultISO')).toHaveText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}/);
  await expect(page.locator('#btnSplunk')).toBeEnabled();
});

test('shows parse error for invalid input', async ({ page }) => {
  await openPopup(page);
  await page.locator('#timeInput').fill('this-is-not-a-time');

  await expect(page.locator('#errorMsg')).toHaveClass(/visible/);
  await expect(page.locator('#btnSplunk')).toBeDisabled();
  await expect(page.locator('#btnCopy')).toBeDisabled();
});
