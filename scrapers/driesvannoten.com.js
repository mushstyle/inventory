import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

async function extractProductInfo(productElement) {
  try {
    const title = await productElement.$eval('.product-card__title', el => el.textContent.trim())
      .catch(() => null);

    const link = await productElement.$eval('.product-card__title', el => el.getAttribute('href'))
      .catch(() => null);

    // Extract the last image URL
    const imageUrl = await productElement.evaluate(el => {
      const slides = el.querySelectorAll('.product-card__img-slider-packshot .swiper-slide:not(.swiper-slide-duplicate)');
      if (slides.length > 0) {
        const lastSlide = slides[slides.length - 1];
        const img = lastSlide.querySelector('img');
        if (img) {
          return img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('data-srcset')?.split(' ')[0] || null;
        }
      }
      return null;
    }).catch(() => null);

    let price = null, currency = null;
    const priceElement = await productElement.$('.product-card__price');

    if (priceElement) {
      const priceText = await priceElement.evaluate(el => el.textContent.trim());
      const priceMatch = priceText.match(/([€$])(\d+(?:\.\d{2})?)/);
      if (priceMatch) {
        currency = priceMatch[1] === '$' ? 'USD' : 'EUR';
        price = parseFloat(priceMatch[2]);
      }
    }

    const sku = await productElement.evaluate(el => el.getAttribute('data-sku'))
      .catch(() => null);

    const gender = await productElement.evaluate(el => el.getAttribute('data-gender'))
      .catch(() => null);

    return {
      title,
      link: link ? (link.startsWith('/') ? link : `/${link}`) : null,
      imageUrl: imageUrl ? (imageUrl.startsWith('//') ? `https:${imageUrl}` : (imageUrl.startsWith('/') ? imageUrl : `/${imageUrl.replace(/^https?:\/\/[^\/]+/, '')}`)).replace(/(_\d+)\.jpg/, '_0.jpg') : null,
      price,
      currency,
      sku,
      gender
    };
  } catch (error) {
    console.error('Error in extractProductInfo:', error);
    return null;
  }
}

async function index(page) {
  /*
  await page.evaluate(() => {
    const button = document.querySelector('#grid-mode-product');
    if (button) {
      button.click();
    } else {
      console.log("Product view button not found");
    }
  });

  // Wait for the page to update after clicking the button
  await new Promise(resolve => setTimeout(resolve, 2000));
  */

  // First, scroll the page
  await autoScroll(page);

  // Wait for images to load
  await page.waitForFunction(() => {
    const images = document.querySelectorAll('.product-card__img-slider-packshot img');
    return Array.from(images).every(img => img.complete && img.naturalHeight !== 0);
  }, { timeout: 30000 });

  // Then extract the data
  const productElements = await page.$$('[theme-product-card]');
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

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let lastHeight = 0;
      let unchanged = 0;
      const maxUnchanged = 5; // Number of attempts before stopping
      const interval = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollTo(0, scrollHeight);

        const itemCount = document.querySelectorAll('[theme-product-card]').length;
        console.log(`Scrolled. Current height: ${scrollHeight}, Total items: ${itemCount}`);

        if (scrollHeight === lastHeight) {
          unchanged++;
          if (unchanged >= maxUnchanged) {
            clearInterval(interval);
            resolve();
          }
        } else {
          unchanged = 0;
          lastHeight = scrollHeight;
        }
      }, 2000); // Scroll every 2 seconds
    });
  });

  // Final count after scrolling is complete
  const finalCount = await page.evaluate(() => {
    return document.querySelectorAll('[theme-product-card]').length;
  });
  console.log(`Scrolling complete. Final item count: ${finalCount}`);
}

export async function run(dbFile, rootUrls) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  let allProducts = [];

  for (const url of rootUrls) {
    console.log(`Processing URL: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0' });
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
    // Load the main page
    await page.goto(url, { waitUntil: 'networkidle0' });
    console.log(`${name} - Main page loaded successfully`);

    // Perform one scroll
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    console.log(`${name} - Page scrolled successfully`);

    // Check if products are loaded
    const productsExist = await page.evaluate(() => {
      return document.querySelectorAll('[theme-product-card]').length > 0;
    });

    if (productsExist) {
      console.log('Products found on the page');
    } else {
      console.log('No products found on the page');
    }

    return true;
  } catch (error) {
    console.error(`${name} - Canary function failed:`, error);
    return false;
  } finally {
    await browser.close();
  }
}