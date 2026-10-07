const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);
  const html = await page.$eval('.category-toolbar', el => el.innerHTML);
  console.log(html);
  await browser.close();
})();
