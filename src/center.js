const playgroundSite = {
  name: 'playground',
  rootUrls: ['https://www.google.com/']
};

const isPlaygroundMode = typeof window !== 'undefined' && window.playwright;

/*
- for each site
- for each url
- load the page
- import navigate functions (getMore)
- if getMore returns true, extract products
- import extractProduct. Run it n times on page
*/

const loadSites = async () => {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const sites = await fs.readFile(path.join(__dirname, '../sites/index.json'), 'utf8');
  return JSON.parse(sites);
};

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
  await browser.close();
};

const main = async () => {
  if (isPlaygroundMode) {
    processSite(playgroundSite);
  }

  else {
    const sites = await loadSites();
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
};

main();