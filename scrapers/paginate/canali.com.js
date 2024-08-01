import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

function extractProductInfo(card) {
  const link = card.querySelector('a')?.getAttribute('href');
  const title = card.querySelector('.vtex-product-summary-2-x-productBrand')?.textContent.trim();
  const priceElement = card.querySelector('.vtex-product-price-1-x-sellingPriceValue');
  const price = priceElement ? parseFloat(priceElement.textContent.replace(/[^0-9.]/g, '')) : null;
  const imageElement = card.querySelector('img');
  const imageUrl = imageElement ? imageElement.getAttribute('src') : null;

  return {
    title: title || null,
    link: link ? (link.startsWith('/') ? link : `/${link}`) : null,
    imageUrl: imageUrl ? (imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`) : null,
    price,
    currency: 'USD',
    sku: null,
    gender: null
  };
}

async function index(page, baseUrl) {
  let allProducts = [];
  let currentPage = 1;
  let hasProducts = true;

  while (hasProducts) {
    console.log(`Indexing page ${currentPage}...`);

    try {
      let url = baseUrl;
      if (currentPage > 1) {
        url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${currentPage}`;
      }
      console.log(`Navigating to ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      const noProductsFound = await page.evaluate(() => {
        return document.body.textContent.includes('No products were found');
      });

      if (noProductsFound) {
        hasProducts = false;
        console.log('No more products found. Stopping pagination.');
        break;
      }

      const products = await page.evaluate((extractFn) => {
        const productCards = document.querySelectorAll('article.vtex-product-summary-2-x-element');
        return Array.from(productCards).map(extractFn);
      }, extractProductInfo);

      if (products.length === 0) {
        hasProducts = false;
        console.log('No products found on this page. Stopping pagination.');
      } else {
        allProducts = allProducts.concat(products);
        currentPage++;
      }
    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error);
      try {
        console.log(`Retrying page ${currentPage}...`);
        await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
        if (currentPage > 1) {
          currentPage++;
        }
      } catch (retryError) {
        console.error(`Failed to retry page ${currentPage}:`, retryError);
        hasProducts = false;
      }
    }
  }

  return allProducts;
}

export async function run(dbFile, rootUrls) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.setDefaultNavigationTimeout(30000);
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