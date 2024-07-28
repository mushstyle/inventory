import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the array from sites/index.json
const sitesData = JSON.parse(await fs.readFile(path.join(__dirname, '../sites/index.json'), 'utf8'));

// Process each site
for (const site of sitesData) {
  const { done, name, rootUrls, scraper, dbFile } = site;

  console.log(`Processing ${name}`);

  // Construct the scraper path
  const scraperPath = path.join(__dirname, '../scrapers', scraper);

  if (done) {
    console.log(`${name} is already done, performing canary test...`);
    /*
    const { canary } = await import(scraperPath);
    canary(rootUrls[0]);
    */
    continue;
  }

  try {
    // Load the scraper module
    const { run } = await import(scraperPath);

    // Call the run function with root_urls
    await run(dbFile, rootUrls);
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      console.error(`Scraper module not found: ${scraperPath}`);
      console.error(`Make sure the file exists and has a .js extension.`);
    } else {
      console.error(`Error processing ${scraper}:`, error);
    }
  }
}