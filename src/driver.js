/*
functions 
- getProducts()
*/

const dbPath = "/Users/blah/pkg/mush/scraper-v2/db"
const sitesPath = "/Users/blah/pkg/mush/scraper-v2/sites"

const getBrowser = async (isPlaygroundMode) => {
  if (isPlaygroundMode) {
    console.log('Loading BrowserBase session in Playground...');
    return window.playwright.chromium.connectOverCDP(window.connectionString);
  } else {
    const { chromium } = await import("playwright-core");
    const { createSession } = await import('./utils.js');
    const session = await createSession();
    console.log(`Connecting to BrowserBase session ${session.id}...`);
    return chromium.connectOverCDP(`wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${session.id}`);
  }
};

const processSite = async (site, { isPlaygroundMode, loadProductsFn, collectProductsFn, extractProductFn }) => {
  const browser = await getBrowser(isPlaygroundMode);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  try {
    await page.goto(site.rootUrls[0]);
    console.log('Page loaded');

    const currProducts = await loadProductsFn(dbPath, site.dbFile);
    console.log(`Loaded ${currProducts.length} products from ${site.dbFile}`);

    // TODO: Implement collectProductsFn and use extractProductFn
    // const newProducts = await collectProductsFn(page, extractProductFn);

  } finally {
    await browser.close();
  }
};

const getConfig = async (isPlaygroundMode) => {
  if (isPlaygroundMode) {
    return {
      loadSitesFn: async () => [playgroundSite],
      loadProductsFn: async () => [],
      siteName: null
    };
  } else {
    const { loadSites, loadProducts } = await import('./utils.js');
    return {
      loadSitesFn: loadSites,
      loadProductsFn: loadProducts,
      siteName: process.argv[2]
    };
  }
};

const main = async (isPlaygroundMode) => {
  const { loadSitesFn, loadProductsFn, siteName } = await getConfig(isPlaygroundMode);
  var sites = await loadSitesFn(sitesPath, "index.json");

  if (siteName) {
    const site = sites.find(site => site.name === siteName);
    if (site) {
      sites = [site];
    } else {
      console.log(`Site ${siteName} not found`);
    }
  }

  for (const site of sites) {
    console.log(`Processing site ${site.name}...`);
    // TODO use playgroundCollectProductsFn and playgroundExtractProductFn if isPlaygroundMode
    const collectProductsFn = isPlaygroundMode ? playgroundCollectProductsFn : null;
    const extractProductFn = isPlaygroundMode ? playgroundExtractProductFn : null;
    await processSite(site, { isPlaygroundMode, loadProductsFn, collectProductsFn, extractProductFn });
  }
};

// Playground-specific code
const playgroundSite = {
  name: 'playground',
  rootUrls: ['https://www.google.com/'],
  dbFile: 'playground.json',
  done: false,
};

const playgroundLoadProductsFn = async () => [];
const playgroundCollectProductsFn = async () => [];
const playgroundExtractProductFn = async () => ({});

// Entry point
//const isPlaygroundMode = typeof window !== 'undefined' && window.playwright;
main(typeof window !== 'undefined' && window.playwright);