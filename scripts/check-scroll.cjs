const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://localhost:5173/admin');
  await page.waitForTimeout(3000);
  
  const styles = await page.evaluate(() => {
    const s = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);
    return {
      bodyOverflow: s.overflow,
      bodyOverflowY: s.overflowY,
      bodyHeight: s.height,
      htmlOverflow: htmlStyle.overflow,
      htmlOverflowY: htmlStyle.overflowY,
      htmlHeight: htmlStyle.height
    };
  });
  console.log('STYLES:', styles);
  await browser.close();
})();
