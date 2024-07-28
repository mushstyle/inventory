import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';

export async function index(page) {
  const products = [];

  // Function to scroll to bottom and wait for new elements to load
  async function scrollAndWait() {
    const previousHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, { timeout: 5000 }).catch(() => { });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
  }

  // Scroll until no more new elements load
  let lastElementCount = 0;
  while (true) {
    await scrollAndWait();
    const currentElementCount = await page.evaluate(() => document.querySelectorAll('.swiper-slide').length);
    console.log(`Scrolled down. Current element count: ${currentElementCount}`);
    if (currentElementCount === lastElementCount) break;
    lastElementCount = currentElementCount;
  }

  // Extract data from the last product
  const productData = await page.evaluate(() => {
    const elements = document.querySelectorAll('.swiper-slide');
    const lastElement = elements[elements.length - 1];

    if (!lastElement) return null;

    const link = lastElement.querySelector('a')?.getAttribute('href');
    const img = lastElement.querySelector('img');
    const imageUrl = img?.getAttribute('src')?.split('?')[0]; // Remove query parameters
    const title = img?.getAttribute('alt');

    return {
      title: title || null,
      link: link ? `/${link.split('/').slice(3).join('/')}` : null,
      imageUrl: imageUrl ? `/${imageUrl.split('/').slice(3).join('/')}` : null,
      price: null,
      currency: null,
      sku: null,
      gender: null,
    };
  });

  if (productData) {
    products.push(productData);
  }

  return products;
}

// The run function as specified
export async function run(dbFile, rootUrls) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  let allProducts = [];

  for (const url of rootUrls) {
    console.log(`Processing URL: ${url}`);
    await page.goto(url);
    const products = await index(page);
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
  await browser.close();
}

export async function canary(name, url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url);
    console.log(`${name} - Main page loaded successfully`);

    // Perform one scroll
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    // Use setTimeout within page.evaluate instead of waitForTimeout
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    console.log(`${name} - Scroll performed successfully`);
  } catch (error) {
    console.error(`${name} - Canary function failed:`, error);
  } finally {
    await browser.close();
  }
}