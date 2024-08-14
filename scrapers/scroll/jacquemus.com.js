import { chromium } from "playwright-core";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createSession } from '../../src/utils.js';

async function acceptCookies(page) {
  const cookieButtonSelector = '#onetrust-accept-btn-handler';
  try {
    await page.waitForSelector(cookieButtonSelector, { timeout: 10000 });
    await page.click(cookieButtonSelector);
    console.log('Accepted cookies');
  } catch (error) {
    console.log('Cookie accept button not found or unable to click');
  }
}

async function scrollToBottomAndWait(page) {
  const previousHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.evaluate(async () => {
    // Scroll up a tiny bit first
    window.scrollBy(0, -10);

    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });

  // Wait for network idle
  await page.waitForLoadState('networkidle');
  const newHeight = await page.evaluate(() => document.body.scrollHeight);
  return newHeight > previousHeight;
}

async function handleOverlays(page) {
  const overlaySelectors = [
    '.modal-close',
    '.popup-close',
    '[aria-label="Close"]',
    '.newsletter-popup .close',
    '.klaviyo-close-form', // Add this new selector
    // Add more selectors as needed
  ];

  for (const selector of overlaySelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      console.log(`Closed overlay: ${selector}`);
    } catch (error) {
      // Overlay not found or couldn't be closed, continue to the next one
    }
  }
}

async function processUrl(browser, url) {
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  try {
    await page.goto(url);
    await acceptCookies(page);
    await page.waitForLoadState('networkidle');

    let canScrollMore = true;
    let scrollCount = 0;
    console.log('Scrolling to bottom');
    await page.mouse.wheel(0, 50);
    console.log('Scrolled to bottom');
    console.log('Waiting for 5 seconds before proceeding...');
    await page.waitForTimeout(5000);
    console.log('5-second wait completed.');
    return;

    while (canScrollMore) {
      console.log(`Scroll attempt ${scrollCount + 1}`);
      await handleOverlays(page);
      canScrollMore = await scrollToBottomAndWait(page);

      if (canScrollMore) {
        scrollCount++;
        // Your code to process the newly loaded content goes here
        // ...
      }
    }

    console.log(`Finished scrolling ${scrollCount} times`);

    // Extract and return product data here
    // const products = await extractProductData(page);
    // return products;

    return []; // Replace this with actual product data
  } finally {
    await page.close();
    await defaultContext.close();
  }
}

export async function run(dbFile, rootUrls) {
  const { id } = await createSession();
  const browser = await chromium.connectOverCDP(
    // we connect to a Session created via the API
    `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${id}`,
  );

  let allProducts = [];

  try {
    for (const url of rootUrls) {
      const products = await processUrl(browser, url);
      allProducts = allProducts.concat(products);
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const outputPath = path.join(__dirname, `../../db/${dbFile}`);
    try {
      await fs.access(outputPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.writeFile(outputPath, '[]');
      }
    }
    await fs.writeFile(outputPath, JSON.stringify(allProducts, null, 2));
    console.log(`Products saved to ${outputPath}`);
  } catch (error) {
    console.error('Error during execution:', error);
  } finally {
    await browser.close();
  }
}