import { chromium } from "playwright-core";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createSession } from '../../src/session.js';

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

async function index(page, url) {
  let products = [];
  let count = 1;
  let done = false;

  while (!done) {
    console.log(`Processing page ${count}`);
    await page.goto(`${url}?page=${count}`);
    await page.waitForLoadState('networkidle');

    console.log('Done loading');

    const cards = await page.$$('.vtex-product-summary-2-x-container');
    for (const card of cards) {
      const productInfo = await card.evaluate(extractProductInfo);
      products.push(productInfo);
    }

    count++;
    if (!(await hasNextLink(page))) {
      console.log("No Next link, breaking");
      done = true;
    }
  }

  return products;
}

async function hasNextLink(page) {
  try {
    const linkLocator = page.getByText("Next");
    const count = await linkLocator.count();
    return count > 0;
  } catch (error) {
    console.log('Error checking for Next link:', error);
    return false;
  }
}

export async function run(dbFile, rootUrls) {
  const { id } = await createSession();
  const browser = await chromium.connectOverCDP(
    // we connect to a Session created via the API
    `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${id}`,
  );
  console.log('Connected!');

  // For demo purposes, we'll wait a second so we can watch.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Get the default browser context and page instances to interact with the page
  const defaultContext = browser.contexts()[0];
  const page = defaultContext.pages()[0];

  try {
    let allProducts = [];

    for (const url of rootUrls) {
      console.log(`Processing URL: ${url}`);
      const products = await index(page, url);
      allProducts = allProducts.concat(products);
    }

    /*
    await window.api.saveToDatabase(dbFile, allProducts);
    console.log(`Products saved to ${dbFile}`);
    */
    console.log(allProducts);
  } catch (error) {
    console.error('Error during execution:', error);
  } finally {
    await browser.close();
  }
}