import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const dir = './temporary screenshots';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

// Capture browser console + network errors
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('requestfailed', req => logs.push(`[NET FAIL] ${req.url()} — ${req.failure()?.errorText}`));
page.on('response', res => {
  if (res.url().includes('formspree')) {
    logs.push(`[FORMSPREE RESPONSE] ${res.status()} ${res.url()}`);
    res.text().then(t => logs.push(`[FORMSPREE BODY] ${t}`)).catch(() => {});
  }
});

await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() =>
  document.getElementById('contact').scrollIntoView({ behavior: 'instant', block: 'start' })
);
await new Promise(r => setTimeout(r, 500));

// Fill the form
await page.type('#firstName', 'Test');
await page.type('#lastName',  'User');
await page.type('#email',     'mrjholt@gmail.com');
await page.type('#bizName',   'Click Lancashire Test');
await page.type('#message',   'Browser test via Puppeteer — automated.');

// Submit and wait up to 20 s
await page.click('#submitBtn');
console.log('Submitted — waiting up to 20 s…');

try {
  await page.waitForFunction(
    () => {
      const btn = document.getElementById('submitBtn');
      return btn.textContent.includes('✓') || btn.classList.contains('error') || btn.textContent.includes('Could not');
    },
    { timeout: 20000 }
  );
} catch {
  console.log('Still waiting after 20 s — capturing state anyway.');
}

await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: path.join(dir, 'form-2-result.png'), fullPage: false });

const { btnText, isError, isSent } = await page.evaluate(() => {
  const btn = document.getElementById('submitBtn');
  return {
    btnText:  btn.textContent.trim(),
    isError:  btn.classList.contains('error'),
    isSent:   btn.classList.contains('sent'),
  };
});

console.log('\n── Result ──────────────────────');
console.log(`Button: "${btnText}"`);
console.log(`Sent:   ${isSent}  |  Error: ${isError}`);
console.log('\n── Browser logs ────────────────');
logs.forEach(l => console.log(l));

await browser.close();
