import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

async function index(page, baseUrl) {
  let allProducts = [];
  let currentPage = 1;
  let hasProducts = true;

  while (hasProducts) {
    console.log(`Indexing page ${currentPage}...`);

    try {
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${currentPage}`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

      const products = await page.evaluate(() => {
        const productCards = document.querySelectorAll('.c-card-product');

        if (productCards.length === 0) {
          return null; // No products found on this page
        }

        return Array.from(productCards).map(card => {
          try {
            const linkElement = card.querySelector('a');
            const link = linkElement ? linkElement.getAttribute('href') : null;

            const titleElement = card.querySelector('.surtitle');
            const title = titleElement ? titleElement.textContent.trim() : null;

            const priceElement = card.querySelector('.c-price__regular');
            const price = priceElement ? parseFloat(priceElement.textContent.trim().replace(/[^0-9.]/g, '')) : null;

            const imageElement = card.querySelector('.c-card-product__thumbnail__hover img');
            const imageUrl = imageElement ? imageElement.getAttribute('data-src') : null;

            const jsonScript = card.querySelector('.js-product-json');
            let productInfo = {};
            if (jsonScript) {
              try {
                productInfo = JSON.parse(jsonScript.textContent);
              } catch (e) {
                console.error('Error parsing JSON:', e);
              }
            }

            return {
              title: title || null,
              link: link ? (link.startsWith('/') ? link : `/${link}`) : null,
              imageUrl: imageUrl ? (imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`) : null,
              price,
              currency: 'USD',
              sku: productInfo.product ? productInfo.product.variants[0]?.sku || null : null,
              gender: productInfo.product ? productInfo.product.type || null : null
            };
          } catch (error) {
            console.error('Error parsing product:', error);
            return null;
          }
        }).filter(product => product !== null);
      });

      if (products === null || products.length === 0) {
        hasProducts = false;
        console.log('No more products found. Stopping pagination.');
      } else {
        allProducts = allProducts.concat(products);
        currentPage++;
      }
    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error);
      hasProducts = false;
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
    await page.setDefaultNavigationTimeout(10000);
    let allProducts = [];

    for (const url of rootUrls) {
      console.log(`Processing URL: ${url}`);
      const products = await index(page, url);
      allProducts = allProducts.concat(products);
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const outputPath = path.join(__dirname, `../db/${dbFile}`);
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

export async function canary(url) {
  console.log('Starting canary test...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    // Test loading the main page
    console.log('Testing main page load...');
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    console.log('Main page loaded successfully.');

    // Test one page navigation
    console.log('Testing page navigation...');
    const nextPageUrl = `${url}${url.includes('?') ? '&' : '?'}page=2`;
    await page.goto(nextPageUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    console.log('Page navigation successful.');

    // Check if products are present
    const productCount = await page.evaluate(() => {
      return document.querySelectorAll('.c-card-product').length;
    });
    console.log(`Found ${productCount} products on the second page.`);

    if (productCount > 0) {
      console.log('Canary test passed successfully.');
    } else {
      console.warn('Canary test warning: No products found on the second page.');
    }

  } catch (error) {
    console.error('Canary test failed:', error);
  } finally {
    await browser.close();
  }
}
