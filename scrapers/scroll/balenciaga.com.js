import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';

async function extractProductInfo(productElement) {
  try {
    const title = await productElement.$eval('.c-product__name', el => el.textContent.trim());

    const link = await productElement.$eval('.c-product__focus', el => el.getAttribute('href'));

    const imageUrls = await productElement.$$eval('.c-product__imageslide:not(.swiper-slide-duplicate) img', imgs =>
      imgs.map(img => img.getAttribute('src'))
    );
    const imageUrl = imageUrls.length >= 3 ? imageUrls[1] : imageUrls[0];

    const priceElement = await productElement.$('.c-price__value--current');
    let price = null;
    let currency = null;
    if (priceElement) {
      const priceText = await priceElement.evaluate(el => el.textContent.trim());
      const match = priceText.match(/(\$|€)\s*(\d+(?:\.\d{2})?)/);
      if (match) {
        currency = match[1] === '$' ? 'USD' : 'EUR';
        price = parseFloat(match[2]);
      }
    }

    const sku = await productElement.evaluate(el => el.getAttribute('data-pid'));

    const gender = await productElement.evaluate(el => {
      const gtmProduct = JSON.parse(el.getAttribute('data-gtmproduct'));
      return gtmProduct.topCategory === 'men' ? 'men' : gtmProduct.topCategory === 'women' ? 'women' : null;
    });

    return {
      title,
      link: link.startsWith('/') ? link : `/${link}`,
      imageUrl: imageUrl.startsWith('http') ? imageUrl : imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://www.balenciaga.com${imageUrl}`,
      price,
      currency,
      sku,
      gender
    };
  } catch (error) {
    console.error('Error extracting product info:', error);
    return null;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      let distance = 100;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  // Wait for new products to load
  await page.waitForFunction(() => {
    const products = document.querySelectorAll('.c-product');
    return products.length > 0;
  }, { timeout: 10000 });

  // Get the number of products
  const productCount = await page.evaluate(() => {
    return document.querySelectorAll('.c-product').length;
  });

  console.log(`Found ${productCount} products after scrolling`);
}

export async function index(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0' });

  let lastProductCount = 0;
  let sameCountIterations = 0;
  const maxSameCountIterations = 3;

  while (true) {
    await autoScroll(page);

    const currentProductCount = await page.evaluate(() => {
      return document.querySelectorAll('.c-product').length;
    });

    if (currentProductCount > lastProductCount) {
      lastProductCount = currentProductCount;
      sameCountIterations = 0;
    } else {
      sameCountIterations++;
      if (sameCountIterations >= maxSameCountIterations) {
        console.log('No new products loaded after multiple scrolls. Stopping.');
        break;
      }
    }

    console.log(`Current product count: ${currentProductCount}`);
  }

  // Extract product data
  const productElements = await page.$$('.c-product');
  const products = [];

  for (const productElement of productElements) {
    try {
      const productInfo = await extractProductInfo(productElement);
      if (productInfo) {
        products.push(productInfo);
      }
    } catch (error) {
      console.error('Error processing product element:', error);
    }
  }

  console.log(`Extracted ${products.length} products`);
  return products;
}

async function processUrl(browser, url, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    const page = await browser.newPage();
    try {
      await page.setDefaultNavigationTimeout(60000);
      console.log(`Processing URL: ${url} (Attempt ${retries + 1})`);
      const products = await index(page, url);
      await page.close();
      return products;
    } catch (error) {
      console.error(`Error processing URL: ${url}`, error);
      await page.close();
      retries++;
      if (retries >= maxRetries) {
        console.error(`Max retries reached for URL: ${url}`);
        return [];
      }
      console.log(`Retrying URL: ${url} (Attempt ${retries + 1})`);
    }
  }
}

export async function run(dbFile, rootUrls) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

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
