import { hashFn } from "../../src/utils.js";

export const collectProducts = async ({ page, gender, extractProductFn }) => {
  await scrollToBottom(page);

  console.log('Collecting products...');
  const productElements = await page.$$('li.product-grid-product');

  const products = (await Promise.all(productElements.map(async (element) => {
    return extractProductFn({ productElement: element, gender });
  }))).filter(product => product !== null);
  console.log(`Collected ${products.length} products`);

  return products;
};

const extractProduct = async ({ productElement, gender }) => {
  const product = {};

  try {
    // Extract title
    product.title = await productElement.$eval('.product-grid-product-info__name', el => el.textContent.trim());

    // Extract link
    product.link = await productElement.$eval('.product-grid-product__link', el => el.href);

    // Generate id using SHA256 hash of the link URL
    product.id = hashFn(product.link);

    // Extract image URL
    product.imageUrl = await productElement.$eval('img.media-image__image', el => el.src);

    // Extract price
    const priceText = await productElement.$eval('.price__amount .money-amount__main', el => el.textContent.trim());
    product.price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

    // Set currency (assuming USD for Zara US)
    product.currency = 'USD';

    // Extract SKU (using data-productid attribute)
    product.sku = await productElement.evaluate(el => el.getAttribute('data-productid'));

    // Gender is not directly available, so we'll leave it as null
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