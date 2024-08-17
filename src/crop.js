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

async function processImages(sites, dbPath, imageMap) {
  for (const site of sites) {
    console.log(`Processing images for ${site.name}`);

    // Load products for the current site
    const dbFile = site.dbFile;
    const baseUrl = site.url;
    const products = await loadProducts(dbPath, dbFile);
    console.log(`Loaded ${products.length} products for ${site.name}`);

    // Process images in batches of 20
    const batchSize = 20;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const promises = batch.map(async (product) => {
        if (product.imageUrl) {
          const imageUrl = fixUrl(baseUrl, product.imageUrl);

          if (imageMap[imageUrl]) {
            console.log(`Image already processed: ${imageUrl}`);
            return;
          }

          try {
            const response = await fetch('https://wardrobe.mush.style/process-image-url', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ url: imageUrl })
            });
            const { imgUrl } = await response.json();
            console.log(`${site.name}: ${imgUrl}`);
            if (imgUrl === undefined) {
              console.log(`Skipping undefined image URL for product: ${product.id}`);
              return;
            }
            imageMap[imageUrl] = imgUrl;
          } catch (e) {
            console.error(e);
          }
        }
      });

      await Promise.all(promises);
      saveImageMap(imageMap, dbPath, imageMapFile);
    }
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