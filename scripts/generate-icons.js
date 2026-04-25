"use strict";

const path = require("path");
const { chromium } = require("@playwright/test");

const SIZES = [16, 48, 128];

function svgMarkup(size) {
  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background:transparent; width:${size}px; height:${size}px; overflow:hidden;">
    <svg viewBox="0 0 18 18" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="9" cy="9" r="8.2" fill="#000000"/>
      <circle cx="9" cy="9" r="7.5" stroke="#3d8eff" stroke-width="1.2"/>
      <path d="M9 5v4.5l2.5 2" stroke="#00d4c8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="9" cy="9" r="1" fill="#00d4c8"/>
    </svg>
  </body>
</html>`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(svgMarkup(size));
    const outPath = path.join(__dirname, "..", "icons", `icon${size}.png`);
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: true,
    });
    console.log(`Generated ${outPath}`);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
