import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

async function index(page) {
  // First, scroll the page
  await autoScroll(page);

  // Then extract the data
  return await page.evaluate(() => {
    const products = Array.from(document.querySelectorAll('.product'));
    return products.map(productElement => {
      const title = productElement.querySelector('.product__title')?.textContent.trim();
      const link = productElement.querySelector('.product__title')?.getAttribute('href');
      const imageUrl = productElement.querySelector('.product__img')?.getAttribute('src');
      const price = parseFloat(productElement.querySelector('.price__current')?.textContent.trim());
      const currency = productElement.querySelector('.price__currency')?.textContent.trim();

      return {
        title,
        link,
        imageUrl,
        price,
        currency
      };
    });
  });
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

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
  await browser.close();
}