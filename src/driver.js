/*
functions 
- getProducts()
*/

const dbPath = "/Users/blah/pkg/mush/scraper-v2/db"
const sitesPath = "/Users/blah/pkg/mush/scraper-v2/sites"

const mergeProducts = (currProducts, newProducts) => {
  // Create a map of current products for efficient lookup
  const currProductMap = new Map(currProducts.map(product => [product.id, product]));

  // Iterate through new products
  for (const newProduct of newProducts) {
    if (currProductMap.has(newProduct.id)) {
      // If the product already exists, replace it
      const index = currProducts.findIndex(product => product.id === newProduct.id);
      currProducts[index] = newProduct;
    } else {
      // If it's a new product, add it to the array
      currProducts.push(newProduct);
    }
  }

  return currProducts;
};

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

const getConfig = async (isPlaygroundMode) => {
  if (isPlaygroundMode) {
    return {
      loadSitesFn: async () => [playgroundSite],
      loadProductsFn: async () => [],
      saveProductsFn: async (products) => { console.log(products); },
      loadScraperFn: async () => { return { collectProductsFn: collectProducts } },
      siteName: null
    };
  } else {
    const { loadSites, loadProducts, saveProducts, loadScraper } = await import('./utils.js');
    return {
      loadSitesFn: loadSites,
      loadProductsFn: loadProducts,
      saveProductsFn: saveProducts,
      loadScraperFn: loadScraper,
      siteName: process.argv[2]
    };
  }
};

const processSite = async (site, { isPlaygroundMode, loadProductsFn, collectProductsFn, saveProductsFn }) => {
  const browser = await getBrowser(isPlaygroundMode);
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  try {
    var mergedProducts = [];
    const currProducts = await loadProductsFn(dbPath, site.dbFile);
    console.log(`Loaded ${currProducts.length} products from ${site.dbFile}`);

    for (const rootPage of site.rootPages) {
      await page.goto(rootPage.url);
      console.log(`Loaded: ${rootPage.url}`);

      const newProducts = await collectProductsFn({ page, gender: rootPage.gender });
      mergedProducts = mergeProducts(currProducts, newProducts);
      console.log(`Merged ${mergedProducts.length} products`);
      await saveProductsFn(mergedProducts, dbPath, site.dbFile);
      console.log(`Saved ${newProducts.length} new products`);
    }

  } finally {
    await browser.close();
  }
};

const main = async (isPlaygroundMode) => {
  const { loadSitesFn, loadProductsFn, saveProductsFn, loadScraperFn, siteName } = await getConfig(isPlaygroundMode);
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
    try {
      console.log(`Processing site ${site.name}...`);
      // TODO use playgroundCollectProductsFn if isPlaygroundMode
      const { collectProductsFn } = await loadScraperFn(site.scraperFile);
      await processSite(site, { isPlaygroundMode, loadProductsFn, saveProductsFn, collectProductsFn });
    } catch (error) {
      console.error(`Error processing site ${site.name}: ${error}`);
    }
  }
};

// Playground-specific code
const playgroundSite = {
  name: "playground",
  rootPages: [
    { url: "https://www.lyst.com/store/ami-alexandre-mattiussi-store", gender: "A" },
  ],
  dbFile: "playground.json",
  done: false,
};

const hashFn = (item) => {
  return `${item.link}-${item.imageUrl}`;
};

const collectProducts = async ({ page, gender }) => {
  console.log('Collecting products...');
  const productElements = await page.$$('div[data-testid="product-card"]');

  const products = (await Promise.all(productElements.map(async (element) => {
    return extractProduct({ productElement: element, gender });
  }))).filter(product => product !== null);

  console.log(`Collected ${products.length} products`);

  return products;
};

const extractProduct = async ({ productElement, gender }) => {
  const product = {};

  try {
    // Extract title
    product.title = await productElement.$eval('span._1b08vvh1s._1b08vvhoj', el => el.textContent.trim());

    // Extract link
    product.link = await productElement.$eval('a[href^="/clothing/"]', el => 'https://www.lyst.com' + el.getAttribute('href'));

    // Extract image URL
    product.imageUrl = await productElement.$eval('img.zmhz363', el => el.src);

    // Generate id using hashFn
    product.id = hashFn({ link: product.link, imageUrl: product.imageUrl });

    // Extract price
    const priceText = await productElement.$eval('div._1b08vvh1w._1b08vvhon._1b08vvh1q', el => el.textContent.trim());
    product.price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

    // Set currency (assuming USD, but you might want to extract this if it varies)
    product.currency = 'USD';

    // Set gender (passed as a parameter)
    product.gender = gender;

  } catch (error) {
    console.error('Error extracting product data:', error);
    return null; // Return null for failed extractions
  }

  return product;
};

async function scrollToBottom(page) {
  const scrollStep = 1000; // Adjust this value to control scroll speed
  let prevScrollPosition = 0;

  while (true) {
    await page.mouse.wheel(0, -20);
    await page.mouse.wheel(0, scrollStep);
    await page.waitForLoadState('networkidle');

    const currentScrollPosition = await page.evaluate(() => window.scrollY);
    if (currentScrollPosition === prevScrollPosition) {
      console.log('Reached the bottom');
      break; // We've reached the bottom
    }
    prevScrollPosition = currentScrollPosition;
  }
}

//const isPlaygroundMode = typeof window !== 'undefined' && window.playwright;
main(typeof window !== 'undefined' && window.playwright);