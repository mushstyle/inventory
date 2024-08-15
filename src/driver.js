/*
functions 
- getProducts()
*/

const dbPath = "/Users/blah/pkg/mush/scraper-v2/db"
const sitesPath = "/Users/blah/pkg/mush/scraper-v2/sites"

const getBrowser = async () => {
  let browser;
  if (isPlaygroundMode) {
    console.log('Loading BrowserBase session in Playground...');
    browser = await window.playwright.chromium.connectOverCDP(window.connectionString);
  } else {
    const { chromium } = await import("playwright-core");
    const { createSession } = await import('./utils.js');
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
const processSite = async (site, { loadProductsFn }) => {
  const browser = await getBrowser();

  const context = browser.contexts()[0];
  const page = context.pages()[0];

  await page.goto(site.rootUrls[0]);
  console.log('Page loaded');

  const currProducts = await loadProductsFn(dbPath, site.dbFile);
  console.log(`Loaded ${currProducts.length} products from ${site.dbFile}`);

  /* meat of the function */
  /*
    - load current products from db path

  */
  await browser.close();
};

const main = async () => {
  let loadSitesFn;
  let loadProductsFn;
  let siteName;
  if (isPlaygroundMode) {
    loadSitesFn = () => [playgroundSite];
    loadProductsFn = () => [];
    siteName = null;
  }
  else {
    const { loadSites, loadProducts } = await import('./utils.js');
    loadSitesFn = loadSites;
    loadProductsFn = loadProducts;
    siteName = process.argv[2];
  }
  const sites = await loadSitesFn(sitesPath, "index.json");

  if (siteName) {
    const site = sites.find(site => site.name === siteName);
    if (site) {
      console.log(`Processing site ${site.name}...`);
      processSite(site, { loadProductsFn });
    }
    else {
      console.log(`Site ${siteName} not found`);
    }
  }
  for (const site of sites) {
    if (site.done) continue;
    await processSite(site, { loadProductsFn });
  }
}

const playgroundSite = {
  name: 'playground',
  rootUrls: ['https://www.google.com/'],
  dbFile: 'playground.json',
  done: false,
};

const playgroundLoadProductsFn = async (dbPath, dbFile) => {
  return [];
}

const isPlaygroundMode = typeof window !== 'undefined' && window.playwright;

main();
