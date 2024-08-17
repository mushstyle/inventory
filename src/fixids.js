import fs from 'fs/promises';
import path from 'path';
import { hashFn } from './utils.js';

const dbPath = "/Users/blah/pkg/mush/scraper-v2/db"
const sitesPath = "/Users/blah/pkg/mush/scraper-v2/sites"

async function fixIds() {
  try {
    // Read and parse the index.json file
    const indexData = JSON.parse(await fs.readFile(path.join(sitesPath, 'index.json'), 'utf-8'));

    for (const site of indexData) {
      if (!site.dbFile) continue;

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

      // Update IDs
      const updatedDbData = dbData.map(item => ({
        ...item,
        id: hashFn(item.link, item.imageUrl, item.sku)
      }));

      // Write the updated data back to the file
      await fs.writeFile(path.join(dbPath, site.dbFile), JSON.stringify(updatedDbData, null, 2));

      console.log(`Updated ${site.name} database`);
    }

    console.log('All database files have been updated.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

fixIds();
