// Screenshots individual sections by scrolling to them
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const url = process.argv[2] || 'http://localhost:3000';
const selector = process.argv[3] || 'body';
const label    = process.argv[4] || 'section';
const dir = './temporary screenshots';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let n = 1;
while (fs.existsSync(path.join(dir, `sec-${n}-${label}.png`))) n++;
const outPath = path.join(dir, `sec-${n}-${label}.png`);

const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
const page    = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
}, selector);
await new Promise(r => setTimeout(r, 600));

await page.screenshot({ path: outPath, fullPage: false });
await browser.close();
console.log(`Saved: ${outPath}`);
