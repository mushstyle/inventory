import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the array from sites/index.json
const sitesData = JSON.parse(await fs.readFile(path.join(__dirname, '../sites/index.json'), 'utf8'));

const processSite = async (name) => {
  const site = sitesData.find(s => s.name === name);

  if (!site) {
    console.error(`Site with name "${name}" not found.`);
    return;
  }

  const { rootUrls, scraper, dbFile } = site;

  console.log(`Processing ${name}`);

  // Construct the scraper path
  const scraperPath = path.join(__dirname, '../scrapers', scraper);

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

const runAll = async (siteName = null) => {
  if (siteName) {
    await processSite(siteName);
  } else {
    // Process each site
    for (const site of sitesData) {
      await processSite(site.name);
    }
  }
}

// Example usage:
// runAll(); // Process all sites
// Check if a site name was provided as a command-line argument
const siteName = process.argv[2];

if (siteName) {
  runAll(siteName);
} else {
  runAll(); // Process all sites if no specific site name was provided
}