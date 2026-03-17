/**
 * @file pdfService.js — Puppeteer-based PDF generation service
 *
 * This module manages a shared Chromium browser instance and exposes a
 * function that converts an HTML string into a PDF buffer.  The browser
 * is launched lazily on the first request and reused across subsequent
 * requests to avoid the overhead of starting a new process every time.
 *
 * Lifecycle:
 *   1. `generatePdf(html)` is called with a fully-rendered HTML string.
 *   2. A new browser *page* (tab) is opened inside the shared browser.
 *   3. The HTML is loaded into the page via `page.setContent()`.
 *   4. `page.pdf()` renders the page to a PDF and returns a Buffer.
 *   5. The page is closed; the browser stays alive for the next request.
 *
 * Graceful shutdown:
 *   Call `closeBrowser()` (e.g. on SIGTERM) to cleanly terminate the
 *   Chromium process so no zombie processes are left behind.
 *
 * @module services/pdfService
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

const puppeteer = require('puppeteer');

const { getLaunchOptions, getDefaultPdfOptions } = require('../config/puppeteer');

/* -------------------------------------------------------------------------- */
/*  Module-level state                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Holds the singleton Puppeteer Browser instance.
 * It is initialised lazily by `getBrowser()` on the first PDF request.
 *
 * @type {import('puppeteer').Browser|null}
 */
let browserInstance = null;

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Return the shared Chromium browser instance, launching it if necessary.
 *
 * Using a singleton avoids the ~1-2 second startup cost on every PDF
 * request.  The browser stays alive until `closeBrowser()` is called
 * or the process exits.
 *
 * @returns {Promise<import('puppeteer').Browser>} The running browser instance.
 */
async function getBrowser() {
  /*
   * If we already have a browser reference, verify it is still connected.
   * Chromium can crash or be OOM-killed; in that case we need to relaunch.
   */
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  /*
   * Launch a new headless Chromium process with the options defined in
   * config/puppeteer.js (sandbox flags, executable path, etc.).
   */
  console.log('[pdfService] Launching Chromium browser...');
  browserInstance = await puppeteer.launch(getLaunchOptions());
  console.log('[pdfService] Chromium browser launched successfully.');

  return browserInstance;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Generate a PDF document from a fully-rendered HTML string.
 *
 * The function:
 *   1. Opens a new page (tab) in the shared Chromium browser.
 *   2. Sets the page content to the provided HTML.
 *   3. Waits until all network requests are idle (images, fonts, etc.).
 *   4. Renders the page to a PDF buffer using configurable options.
 *   5. Closes the page to free memory.
 *
 * @param {string} html — Complete HTML document to render.
 * @param {import('puppeteer').PDFOptions} [pdfOptions] — Optional overrides
 *   for `page.pdf()`.  Merged on top of the defaults from config.
 * @returns {Promise<Buffer>} Raw PDF bytes suitable for streaming to the client.
 *
 * @throws {Error} If Chromium fails to launch or the page cannot be rendered.
 *
 * @example
 *   const { generatePdf } = require('./services/pdfService');
 *   const pdfBuffer = await generatePdf('<h1>Hello</h1>');
 *   res.set('Content-Type', 'application/pdf');
 *   res.send(pdfBuffer);
 */
async function generatePdf(html, pdfOptions = {}) {
  const browser = await getBrowser();

  /*
   * Each request gets its own page to avoid any state leaking between
   * concurrent PDF generations.  Pages are lightweight — Chromium can
   * handle dozens in parallel without significant overhead.
   */
  const page = await browser.newPage();

  try {
    /*
     * Set the HTML content on the page.
     *
     * `waitUntil: 'networkidle0'` tells Puppeteer to wait until there are
     * zero in-flight network requests for at least 500 ms.  This ensures
     * any external resources referenced in the template (fonts loaded via
     * @import, images, etc.) are fully loaded before we capture the PDF.
     */
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    /*
     * Merge the caller's PDF options on top of our defaults.
     * This lets individual endpoints override format, margins, etc.
     * while still inheriting sensible defaults.
     */
    const mergedOptions = {
      ...getDefaultPdfOptions(),
      ...pdfOptions,
    };

    /*
     * Render the page to a PDF.  The result is a Node.js Buffer containing
     * the raw PDF bytes, which can be sent directly in an HTTP response
     * with Content-Type: application/pdf.
     */
    const pdfBuffer = await page.pdf(mergedOptions);

    return pdfBuffer;
  } finally {
    /*
     * Always close the page, even if an error occurred above.
     * This prevents memory leaks from accumulated zombie pages.
     */
    await page.close();
  }
}

/**
 * Gracefully close the shared Chromium browser instance.
 *
 * This should be called during application shutdown (e.g. on SIGTERM or
 * SIGINT) to ensure the Chromium child process is terminated cleanly.
 * Failing to do so may leave zombie `chrome` processes on the host.
 *
 * @returns {Promise<void>}
 */
async function closeBrowser() {
  if (browserInstance) {
    console.log('[pdfService] Closing Chromium browser...');
    await browserInstance.close();
    browserInstance = null;
    console.log('[pdfService] Chromium browser closed.');
  }
}

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = {
  generatePdf,
  closeBrowser,
};
