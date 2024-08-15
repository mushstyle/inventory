import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function createSession() {
  const response = await fetch(`https://www.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": `${process.env.BROWSERBASE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: {
        // Fingerprint options
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["macos"],
        },
      },
    }),
  });
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }
  return json;
}

export async function loadSites(sitesPath, sitesFile) {
  const sites = await fs.readFile(path.join(sitesPath, sitesFile), 'utf8');

  return JSON.parse(sites);
};

export async function loadProducts(dbPath, dbFile) {
  try {
    const products = await fs.readFile(path.join(dbPath, dbFile), 'utf8');

    return JSON.parse(products);
  } catch (error) {
    // If the file doesn't exist, return an empty array
    return [];
  }
}

export async function saveProducts(products, dbPath, dbFile) {
  await fs.writeFile(path.join(dbPath, dbFile), JSON.stringify(products, null, 2), 'utf8');
  console.log(`Saved products to ${path.join(dbPath, dbFile)}`);
}

export async function loadScraper(scraperFile) {
  const scraper = await import(`../scrapers/${scraperFile}`);
  return { collectProductsFn: scraper.collectProducts, extractProductFn: scraper.extractProduct };
}

export function hashFn(link) {
  return crypto.createHash('sha256').update(link).digest('hex');
}