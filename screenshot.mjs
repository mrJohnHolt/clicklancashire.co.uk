import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';
const dir   = './temporary screenshots';

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Auto-increment filename
let n = 1;
while (fs.existsSync(path.join(dir, `screenshot-${n}${label}.png`))) n++;
const outPath = path.join(dir, `screenshot-${n}${label}.png`);

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

// Let fonts and animations settle
await new Promise(r => setTimeout(r, 1800));

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(`Saved: ${outPath}`);
