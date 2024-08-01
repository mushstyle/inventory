import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';

async function extractProductInfo(element) {
  const product = {
    title: null,
    link: null,
    imageUrl: null,
    price: null,
    currency: null,
    sku: null,
    gender: null
  };

  try {
    product.title = await element.$eval('.product-title', el => el.textContent.trim());

    const link = await element.$eval('a.producttile-wrapper', el => el.getAttribute('href'));
    if (link) {
      product.link = new URL(link, 'https://www.cos.com').pathname;
      product.gender = product.link.includes('/men/') ? 'men' : product.link.includes('/women/') ? 'women' : null;
    }

    // Extract full image URL
    const images = await element.$$eval('img', imgs =>
      imgs.map(img => {
        const dataChain = img.getAttribute('data-resolvechain');
        if (dataChain && dataChain.includes('DESCRIPTIVESTILLLIFE')) {
          const match = dataChain.match(/source\[(.*?)\],origin\[(.*?)\],type\[(.*?)\]/);
          if (match) {
            const [, source, origin, type] = match;
            return `https://lp.cosstores.com/app001prod?set=source[${source}],origin[${origin}],type[${type}]&call=url[file:/product/main]`;
          }
        }
        return null;
      })
    );
    product.imageUrl = images.find(url => url !== null) || null;

    product.sku = await element.$eval('.articleCode', el => el.textContent.trim());

    const priceElement = await element.$('.m-product-price span');
    if (priceElement) {
      const priceText = await priceElement.evaluate(el => el.textContent.trim());
      product.price = parseFloat(priceText.replace(/[^\d.]/g, ''));
      product.currency = priceText.startsWith('$') ? 'USD' : null;
    }

  } catch (error) {
    console.error('Error extracting product info:', error);
  }

  return product;
}

export async function index(page, url) {
  let products = [];
  let pageNumber = 1;

  while (true) {
    console.log(`Processing page ${pageNumber}`);

    if (pageNumber === 1) {
      await page.goto(url, { waitUntil: 'networkidle0' });
    }

    // Wait for the product elements to load
    await page.waitForSelector('.o-product');

    const productElements = await page.$$('.o-product');

    for (const element of productElements) {
      const product = await extractProductInfo(element);
      if (product.title) {
        products.push(product);
      }
    }

    // Check for the "End of List" button
    const endOfListButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(button => button.textContent.includes('End of List'));
    });
    if (endOfListButton) {
      console.log('Reached end of list. Stopping pagination.');
      break;
    }

    // Navigate to the next page
    console.log("Navigating to next page");
    const currentUrl = await page.url();
    const currentPageMatch = currentUrl.match(/page=(\d+)/);
    let nextPageNumber = 1;
    if (currentPageMatch) {
      nextPageNumber = parseInt(currentPageMatch[1]) + 1;
    }
    const nextPageUrl = currentUrl.includes('?page=')
      ? currentUrl.replace(/page=\d+/, `page=${nextPageNumber}`)
      : `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}page=${nextPageNumber}`;
    await page.goto(nextPageUrl, { waitUntil: 'networkidle0' });

    pageNumber++;
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
