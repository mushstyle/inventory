import fs from 'fs/promises';
import path from 'path';
import { hashFn } from './utils.js';

const dbPath = "/Users/blah/pkg/mush/scraper-v2/db"
const sitesPath = "/Users/blah/pkg/mush/scraper-v2/sites"

const fixUrl = (baseUrl, url) => {
  if (url === null) {
    return null;
  }
  if (url.startsWith('//')) {
    return `https:${url}`;
  } else if (url.startsWith('/')) {
    return `${baseUrl}${url}`;
  }
  return url;
};

async function fixDb() {
  try {
    // Read and parse the index.json file
    const indexData = JSON.parse(await fs.readFile(path.join(sitesPath, 'index.json'), 'utf-8'));

    for (const site of indexData) {
      if (!site.dbFile) continue;
      const baseUrl = site.url;

      console.log(`Processing ${site.name}...`);

      // Read and parse the database file
      let dbData;
      try {
        dbData = JSON.parse(await fs.readFile(path.join(dbPath, site.dbFile), 'utf-8'));
      } catch (error) {
        console.error(`Error reading ${site.name} database:`, error.message);
        continue;
      }
      console.log(`${site.name} has ${dbData.length} items`);

      // Update IDs and fix URLs
      const updatedDbData = dbData.map(item => {
        const link = fixUrl(baseUrl, item.link);
        const imageUrl = fixUrl(baseUrl, item.imageUrl);
        const id = hashFn(link, imageUrl, item.sku);
        return {
          ...item,
          id,
          link,
          imageUrl,
        };
      });

      // Write the updated data back to the file
      await fs.writeFile(path.join(dbPath, site.dbFile), JSON.stringify(updatedDbData, null, 2));

      console.log(`Updated ${site.name} database`);
    }

    console.log('All database files have been updated.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

fixDb();