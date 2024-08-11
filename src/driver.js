/*
functions 
- getProducts()
*/

const getBrowser = async () => {
  let browser;
  if (isPlaygroundMode) {
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

  /* meat of the function */


  await browser.close();
};

const main = async () => {
  let sites;
  if (isPlaygroundMode) {
    processSite(playgroundSite);
    return;
  } else {
    const { loadSites } = await import('./session.js');
    sites = await loadSites();
  }
  const siteName = process.argv[2];
  if (siteName) {
    const site = sites.find(site => site.name === siteName);
    if (site) {
      console.log(`Processing site ${site.name}...`);
      //processSite(site);
    }
    else {
      console.log(`Site ${siteName} not found`);
    }
  }
  for (const site of sites) {
    if (site.done) continue;
    await processSite(site);
  }
}

const playgroundSite = {
  name: 'playground',
  rootUrls: ['https://www.google.com/']
};

const isPlaygroundMode = typeof window !== 'undefined' && window.playwright;

main();
