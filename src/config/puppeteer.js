/**
 * @file puppeteer.js — Puppeteer / Chromium launch configuration
 *
 * This module exports a function that returns the launch options object passed
 * to `puppeteer.launch()`. The options are derived from environment variables
 * so the same codebase works both locally (where Puppeteer ships its own
 * Chromium) and inside Docker (where we install Chromium via apt and need
 * the --no-sandbox flag).
 *
 * @module config/puppeteer
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

/**
 * We load dotenv here (in addition to app.js) so that this config module can
 * be imported independently during testing or one-off scripts without
 * relying on the Express entry-point having run first.
 */
require('dotenv').config();

/* -------------------------------------------------------------------------- */
/*  Configuration builder                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build and return the Puppeteer launch-options object.
 *
 * The returned object is suitable for passing directly to
 * `puppeteer.launch(getLaunchOptions())`.
 *
 * @returns {import('puppeteer').LaunchOptions} Puppeteer launch options.
 *
 * @example
 *   const puppeteer = require('puppeteer');
 *   const { getLaunchOptions } = require('./config/puppeteer');
 *   const browser = await puppeteer.launch(getLaunchOptions());
 */
function getLaunchOptions() {
  /*
   * Determine whether the Chromium sandbox should be disabled.
   *
   * Inside Docker the container itself provides isolation, and running the
   * sandbox as a non-root user requires kernel capabilities that are
   * typically unavailable.  Setting PUPPETEER_NO_SANDBOX=true in the
   * environment (see Dockerfile & docker-compose.yml) disables it.
   *
   * On a developer's local machine this defaults to false so the sandbox
   * stays active for an extra layer of security.
   */
  const noSandbox = process.env.PUPPETEER_NO_SANDBOX === 'true';

  /*
   * Chromium CLI arguments.
   *
   * --no-sandbox          : required in Docker (see above).
   * --disable-setuid-sandbox : companion flag to --no-sandbox.
   * --disable-dev-shm-usage  : Docker's default /dev/shm is 64 MB which is
   *                            too small for Chromium; this flag tells it to
   *                            write shared-memory files to /tmp instead.
   * --disable-gpu         : headless mode doesn't need GPU compositing.
   */
  const args = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ];

  if (noSandbox) {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  /*
   * Assemble the final options object.
   */
  /** @type {import('puppeteer').LaunchOptions} */
  const options = {
    /* Run Chromium without a visible window. */
    headless: true,

    /* CLI flags assembled above. */
    args,

    /*
     * If CHROMIUM_PATH is set (e.g. to /usr/bin/chromium inside Docker),
     * use that binary instead of Puppeteer's bundled Chromium.
     * When the variable is empty or unset we let Puppeteer resolve its
     * own bundled copy automatically.
     */
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  };

  return options;
}

/* -------------------------------------------------------------------------- */
/*  PDF default options                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Default options passed to `page.pdf()` when generating a PDF document.
 *
 * These can be overridden per-request if the API evolves to accept PDF
 * customisation parameters, but for now they provide sensible defaults
 * that match most use-cases (A4 paper, background graphics enabled, etc.).
 *
 * @returns {import('puppeteer').PDFOptions} Default PDF generation options.
 */
function getDefaultPdfOptions() {
  return {
    /* Paper size — read from env or default to A4 (210 x 297 mm). */
    format: process.env.PDF_FORMAT || 'A4',

    /*
     * printBackground must be true for our templates' coloured headers,
     * background images, and CSS gradients to appear in the PDF output.
     */
    printBackground: process.env.PDF_PRINT_BACKGROUND !== 'false',

    /*
     * Page margins.  These are intentionally slim so the template's own
     * padding controls the visible whitespace.
     */
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm',
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = {
  getLaunchOptions,
  getDefaultPdfOptions,
};
