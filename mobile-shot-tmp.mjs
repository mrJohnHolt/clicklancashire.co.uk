import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:3000';
const out = './temporary screenshots/mobile-navfix.png';

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 300, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: out });
await browser.close();
console.log('Saved: ' + out);
