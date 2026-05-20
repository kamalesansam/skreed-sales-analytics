const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[PAGE CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  console.log("Navigating to http://localhost:3000 ...");
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  
  console.log("Page loaded. Waiting 3 seconds for charts to mount and hydrate...");
  await new Promise(r => setTimeout(r, 3000));
  
  await browser.close();
  console.log("Browser closed.");
})();
