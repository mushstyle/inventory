/*
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
*/

/*
- for each site
- for each url
- load the page
- import navigate functions (getMore)
- if getMore returns true, extract products
- import extractProduct. Run it n times on page
*/

const getBrowser = async () => {
  let browser;
  if (typeof window !== 'undefined' && window.playwright) {
    console.log('Loading BrowserBase session in Playground...');
    browser = await window.playwright.chromium.connectOverCDP(window.connectionString);
  } else {
    const { chromium } = await import("playwright-core");
    const { createSession } = await import('./session.js');
    const session = await createSession();
    console.log(`Connecting to BrowserBase session ${session.id}...`);
    browser = await chromium.connectOverCDP(`wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${session.id}`);
  }
  return browser;
}
/**
 * 
 * @param {object} site 
 */
const processSite = async (site) => {
  const browser = await getBrowser();

  const context = browser.contexts()[0];
  const page = context.pages()[0];

  await page.goto(site.rootUrls[0]);
  console.log('Page loaded');
};

await processSite({ rootUrls: ['https://www.google.com/'] });