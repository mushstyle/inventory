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

async function readJSONFile(filePath, defaultValue) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return defaultValue;
  }
}

async function writeJSONFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Saved data to ${filePath}`);
}

export async function loadSites(sitesPath, sitesFile) {
  return readJSONFile(path.join(sitesPath, sitesFile));
}

export async function loadProducts(dbPath, dbFile) {
  return readJSONFile(path.join(dbPath, dbFile), []);
}

export async function loadImageMap(dbPath, dbFile) {
  return readJSONFile(path.join(dbPath, dbFile), {});
}

export async function saveProducts(products, dbPath, dbFile) {
  console.log(`Saving ${products.length} products to ${path.join(dbPath, dbFile)}`);
  await writeJSONFile(path.join(dbPath, dbFile), products);
}

export async function saveImageMap(imageMap, dbPath, dbFile) {
  console.log(`Saving image map with ${Object.keys(imageMap).length} entries to ${path.join(dbPath, dbFile)}`);
  await writeJSONFile(path.join(dbPath, dbFile), imageMap);
}

export async function loadScraper(scraperFile) {
  const scraper = await import(`../scrapers/${scraperFile}`);
  return { collectProductsFn: scraper.collectProducts, extractProductFn: scraper.extractProduct };
}

export function hashFn(link) {
  return crypto.createHash('sha256').update(link).digest('hex');
}