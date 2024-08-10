import { chromium } from "playwright-core";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createSession } from './session.js';

/*
- for each site
- for each url
- load the page
- import navigate functions (getMore)
- if getMore returns true, extract products
- import extractProduct. Run it n times on page
*/

/**
 * 
 * @param {object} site 
 */
const processSite = async (site) => {
  // load a new session 

  let browser;
  if (typeof window !== 'undefined' && window.playwright) {
    console.log('Loading BrowserBase session locally');
    browser = await window.playwright.chromium.connectOverCDP(window.connectionString);
  } else {
    console.log('Loading BrowserBase session remotely');
    const { id } = await createSession();
    browser = await chromium.connectOverCDP(id);
  }
  const context = browser.contexts()[0];
  const page = context.pages()[0];

  await page.goto(site.rootUrls[0]);
};

await processSite({ rootUrls: ['https://www.google.com/'] });