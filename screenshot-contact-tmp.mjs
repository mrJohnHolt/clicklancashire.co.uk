import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
const el = await page.$('#contact');
await el.screenshot({ path: 'temporary screenshots/contact-meta-check.png' });
await browser.close();
