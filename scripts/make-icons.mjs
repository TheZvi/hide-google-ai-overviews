// Renders extension/icons/icon{16,32,48,128}.png from an inline SVG using Playwright.
// Run once (npm run icons); the PNGs are committed.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#1a73e8"/>
  <path d="M64 22 L72 52 L102 60 L72 68 L64 98 L56 68 L26 60 L56 52 Z" fill="#fff"/>
  <line x1="24" y1="104" x2="104" y2="24" stroke="#d93025" stroke-width="14" stroke-linecap="round"/>
</svg>`;

mkdirSync("extension/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`
  );
  await page.screenshot({ path: `extension/icons/icon${size}.png`, omitBackground: true });
}
await browser.close();
console.log("icons written");
