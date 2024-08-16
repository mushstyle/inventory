import { loadSites, loadProducts, loadImageMap, saveImageMap, saveProducts } from './utils.js';

const dbPath = "/Users/blah/pkg/mush/scraper-v2/db"
const sitesPath = "/Users/blah/pkg/mush/scraper-v2/sites"
const imageMapFile = 'cropped_images.db.json';

const fixUrl = (baseUrl, url) => {
  if (url.startsWith('//')) {
    return `https:${url}`;
  } else if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  return url;
};

var count = 0;
async function processImages(sites, dbPath, imageMap) {
  for (const site of sites) {
    console.log(`Processing images for ${site.name}`);

    // Load products for the current site
    const dbFile = site.dbFile;
    const baseUrl = site.url;
    const products = await loadProducts(dbPath, dbFile);
    console.log(`Loaded ${products.length} products for ${site.name}`);

    // Process images for each product
    for (const product of products) {
      if (product.imageUrl) {
        const imageUrl = fixUrl(baseUrl, product.imageUrl);

        if (imageMap[imageUrl]) {
          console.log(`Image already processed: ${imageUrl}`);
          continue;
        }

        const response = await fetch('https://wardrobe.mush.style/process-image-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: imageUrl })
        });
        try {
          const imgUrl = (await response.json()).imgUrl;
          console.log(`${site.name}: ${imgUrl}`);
          if (imgUrl === undefined) {
            console.log(`Skipping undefined image URL for product: ${product.id}`);
            continue;
          }
          imageMap[imageUrl] = imgUrl;
          count++;
          if (count % 20 == 0) {
            saveImageMap(imageMap, dbPath, imageMapFile);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    saveImageMap(imageMap, dbPath, imageMapFile);
  }
}

async function main() {
  const sitesFile = 'index.json';
  try {
    const sites = await loadSites(sitesPath, sitesFile);
    const imageMap = await loadImageMap(dbPath, imageMapFile);
    await processImages(sites, dbPath, imageMap);
    console.log('Image processing completed');
  } catch (error) {
    console.error('Error processing images:', error);
  }
}

main();
