const puppeteer = require('puppeteer');
const http = require('http');

async function trigger(agent) {
  return new Promise((resolve) => {
    const req = http.request(`http://localhost:3000/api/cron/${agent}`, {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET || 'test_secret'
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', (e) => resolve(e.message));
    req.end();
  });
}

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  
  // Test 1: KB Drawer
  console.log('Skipping...');
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 1280, height: 800 });
  await page1.goto('http://localhost:3000/ai-operations');
  await page1.waitForSelector('text/The Matchmaker', { timeout: 10000 });
  await page1.click('text/The Matchmaker'); // expand
  await new Promise(r => setTimeout(r, 1000));
  
  // Click the first run item in the timeline
  await page1.evaluate(() => {
    const el = document.querySelector('.timeline-item');
    if (el) el.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  // Drawer should be open, scroll to kb_query
  await page1.evaluate(() => {
    const drawer = document.querySelector('[role="dialog"]');
    if (drawer) drawer.scrollTop = drawer.scrollHeight;
  });
  await new Promise(r => setTimeout(r, 500));
  await page1.screenshot({ path: 'test1_kb_query.png' });
  console.log('Test 1 captured: test1_kb_query.png');
  
  // Test 2: SSE Live streaming
  console.log('Skipping...');
  const page2_a = await browser.newPage();
  await page2_a.setViewport({ width: 800, height: 800 });
  await page2_a.goto('http://localhost:3000/ai-operations');
  
  const page2_b = await browser.newPage();
  await page2_b.setViewport({ width: 800, height: 800 });
  await page2_b.goto('http://localhost:3000/ai-operations');
  
  await new Promise(r => setTimeout(r, 2000)); // let SSE connect
  
  console.log('Triggering reminders agent...');
  trigger('reminders');
  
  await new Promise(r => setTimeout(r, 3000)); // wait for 'Running now' pulse
  
  // Capture side-by-side using a composite page or just two screenshots
  await page2_a.screenshot({ path: 'test2_sse_window_A.png' });
  await page2_b.screenshot({ path: 'test2_sse_window_B.png' });
  console.log('Test 2 captured: test2_sse_window_A.png, test2_sse_window_B.png');
  
  // Wait for it to finish and bump
  await new Promise(r => setTimeout(r, 8000));
  await page2_a.screenshot({ path: 'test2_sse_completed.png' });
  
  // Test 3: ⌘K palette
  console.log('Running Test 3...');
  const page3 = await browser.newPage();
  await page3.setViewport({ width: 1280, height: 800 });
  await page3.goto('http://localhost:3000/ai-operations');
  await new Promise(r => setTimeout(r, 1000));
  
  // Press Cmd+K
  await page3.keyboard.down('Meta');
  await page3.keyboard.press('k');
  await page3.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 500));
  
  // Type match
  await page3.keyboard.type('match');
  await new Promise(r => setTimeout(r, 500));
  await page3.screenshot({ path: 'test3_palette.png' });
  console.log('Test 3 captured: test3_palette.png');
  
  // Press Enter
  await page3.keyboard.press('Enter');
  console.log('Triggered Matchmaker via Enter');
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  console.log('Done.');
})();
