import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';

async function extractProductInfo(element) {
  const title = await element.$eval('.pdp-link .link a', el => el.textContent.trim());
  const link = await element.$eval('.pdp-link .link a', el => el.getAttribute('href'));

  // Get the actual image URL from the data-srcset attribute
  const imageSrcset = await element.$eval('.tile-image', el => el.getAttribute('data-srcset'));
  const imageUrl = imageSrcset ? imageSrcset.split(' ')[0] : null;

  const priceText = await element.$eval('.price .value', el => el.textContent.trim());
  const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
  const currency = priceText.includes('$') ? 'USD' : null;
  const sku = await element.evaluate(el => el.getAttribute('data-tile-id'));
  const gender = null; // Gender information is not available in the provided HTML

  return {
    title,
    link,
    imageUrl,
    price,
    currency,
    sku,
    gender,
  };
}

export async function index(page, url) {
  await page.goto(url, { waitUntil: 'networkidle0' });

  const products = [];
  let hasMoreItems = true;

  while (hasMoreItems) {
    // Extract current page's products
    const currentProducts = await page.$$eval('.product-tile', (elements) => {
      return elements.map(element => {
        const title = element.querySelector('.pdp-link .link a').textContent.trim();
        const link = element.querySelector('.pdp-link .link a').getAttribute('href');

        const imageSrcset = element.querySelector('.tile-image').getAttribute('data-srcset');
        const imageUrl = imageSrcset ? imageSrcset.split(' ')[0] : null;

        const priceText = element.querySelector('.price .value').textContent.trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        const currency = priceText.includes('$') ? 'USD' : null;
        const sku = element.getAttribute('data-tile-id');
        const gender = null;

        return { title, link, imageUrl, price, currency, sku, gender };
      });
    });

    products.push(...currentProducts);

    // Check for and click "View More" button
    hasMoreItems = await page.evaluate(() => {
      const viewMoreButton = document.querySelector('.js-jil-show-more');
      if (viewMoreButton && !viewMoreButton.disabled) {
        viewMoreButton.click();
        return true;
      }
      return false;
    });

    if (hasMoreItems) {
      await page.waitForNetworkIdle({ idleTime: 1000 });
    }
  }

  // Ensure full URLs for all products
  const baseUrl = new URL(url).origin;
  products.forEach(product => {
    product.link = new URL(product.link, baseUrl).href;
    product.imageUrl = product.imageUrl ? new URL(product.imageUrl, baseUrl).href : null;
  });

  console.log(`Total products extracted: ${products.length}`);
  if (products.length > 0) {
    console.log('First product information:');
    console.log(JSON.stringify(products[0], null, 2));
  } else {
    console.log('No products found');
  }

  return products;
}

export async function run(dbFile, rootUrls) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.setDefaultNavigationTimeout(10000);
    let allProducts = [];

    for (const url of rootUrls) {
      console.log(`Processing URL: ${url}`);
      const products = await index(page, url);
      allProducts = allProducts.concat(products);
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const outputPath = path.join(__dirname, `../../db/${dbFile}`);
    try {
      await fs.access(outputPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create an empty file
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
