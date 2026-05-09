const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const BASE = 'http://localhost:3000';
  const shots = [
    { url: `${BASE}/appointments`, name: 'screenshot_appointments.png' },
    { url: `${BASE}/calls`, name: 'screenshot_calls.png' },
    { url: `${BASE}/agent-activity`, name: 'screenshot_agent_activity.png' },
    { url: `${BASE}/kb`, name: 'screenshot_kb.png' },
  ];

  for (const { url, name } of shots) {
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: name, fullPage: true });
    console.log('Screenshot saved:', name);
  }

  // Calls drawer — click first row if exists
  console.log('Attempting calls drawer...');
  await page.goto(`${BASE}/calls`, { waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  const firstRow = await page.$('.table tbody tr');
  if (firstRow) {
    await firstRow.click();
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'screenshot_calls_drawer.png', fullPage: true });
    console.log('Calls drawer screenshot saved');
  } else {
    console.log('No calls rows found');
    await page.screenshot({ path: 'screenshot_calls_drawer.png', fullPage: true });
  }

  await browser.close();
  console.log('All screenshots done.');
})();
