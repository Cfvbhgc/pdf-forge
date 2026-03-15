/**
 * @file app.js — PDF Forge application entry point
 *
 * This is the main entry point for the PDF Forge server.  It:
 *   1. Loads environment variables from .env (if present).
 *   2. Creates and configures an Express application with JSON parsing,
 *      CORS support, and request logging.
 *   3. Mounts the API routes (PDF generation, template discovery).
 *   4. Registers the global error handler.
 *   5. Starts the HTTP server and listens on the configured port.
 *   6. Sets up graceful shutdown handlers (SIGTERM, SIGINT) so the
 *      Chromium browser process is closed cleanly.
 *
 * Usage:
 *   node src/app.js          # production start
 *   npx nodemon src/app.js   # development with auto-reload
 *
 * @module app
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  1. Environment variables                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Load variables from a .env file in the project root into `process.env`.
 * If no .env file exists this is a no-op — the app falls back to the
 * defaults defined alongside each `process.env.VARIABLE` access.
 */
require('dotenv').config();

/* -------------------------------------------------------------------------- */
/*  2. Dependencies                                                           */
/* -------------------------------------------------------------------------- */

const express = require('express');
const cors    = require('cors');

/* Route modules */
const generateRoutes  = require('./routes/generate');
const templatesRoutes = require('./routes/templates');

/* Middleware */
const errorHandler = require('./middleware/errorHandler');

/* Services (imported for graceful shutdown) */
const { closeBrowser } = require('./services/pdfService');

/* -------------------------------------------------------------------------- */
/*  3. Application setup                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The Express application instance.
 * @type {import('express').Application}
 */
const app = express();

/**
 * Port the server will listen on.
 * Read from environment or default to 3003.
 * @type {number}
 */
const PORT = parseInt(process.env.PORT, 10) || 3003;

/* -------------------------------------------------------------------------- */
/*  4. Global middleware                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Enable Cross-Origin Resource Sharing for all origins.
 *
 * In production you would restrict this to specific domains, but for a
 * developer-focused tool like PDF Forge, allowing all origins makes
 * integration testing from any frontend straightforward.
 */
app.use(cors());

/**
 * Parse incoming JSON request bodies.
 *
 * The `limit` option is increased to 5 MB because report/resume data
 * payloads with many sections or long descriptions can be large.
 * The default Express limit of 100 KB is too low for this use case.
 */
app.use(express.json({ limit: '5mb' }));

/**
 * Simple request logger.
 *
 * Logs every incoming request with its HTTP method, URL, and a timestamp.
 * In a production app you would replace this with a structured logging
 * library (e.g. Morgan, Pino, Winston), but a plain console.log keeps
 * the dependency count low.
 */
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

/* -------------------------------------------------------------------------- */
/*  5. Route registration                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Health-check endpoint.
 *
 * Returns a simple JSON response confirming the server is alive.
 * Useful for Docker HEALTHCHECK, load-balancer probes, and quick
 * smoke tests.
 *
 * @route GET /
 */
app.get('/', (_req, res) => {
  res.json({
    service: 'PDF Forge',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      generate: 'POST /api/generate',
      templates: 'GET /api/templates',
      preview: 'GET /api/templates/:name/preview',
    },
  });
});

/**
 * Mount the PDF generation route at /api.
 * This gives us:  POST /api/generate
 */
app.use('/api', generateRoutes);

/**
 * Mount the template discovery routes at /api/templates.
 * This gives us:
 *   GET /api/templates
 *   GET /api/templates/:name/preview
 */
app.use('/api/templates', templatesRoutes);

/* -------------------------------------------------------------------------- */
/*  6. Error handling                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 404 handler for unmatched routes.
 *
 * This must come *after* all route registrations but *before* the global
 * error handler.  It catches any request that didn't match a defined route
 * and returns a helpful JSON response.
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    hint: 'Use GET / to see available endpoints.',
  });
});

/**
 * Global error handler (must be the LAST middleware registered).
 *
 * Catches any error thrown or passed to `next(err)` anywhere in the
 * middleware chain and returns a structured JSON error response.
 */
app.use(errorHandler);

/* -------------------------------------------------------------------------- */
/*  7. Start server                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Start the HTTP server and begin accepting connections.
 */
const server = app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`  PDF Forge is running`);
  console.log(`  Port       : ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Time       : ${new Date().toISOString()}`);
  console.log('==============================================');
  console.log('');
  console.log('  Endpoints:');
  console.log(`    POST /api/generate              — Generate a PDF`);
  console.log(`    GET  /api/templates              — List templates`);
  console.log(`    GET  /api/templates/:name/preview — Preview template`);
  console.log('');
});

/* -------------------------------------------------------------------------- */
/*  8. Graceful shutdown                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Handle termination signals so we can clean up resources (most importantly
 * the Chromium browser process) before the Node.js process exits.
 *
 * Without this, a `docker stop` or Ctrl+C would leave a zombie Chromium
 * process on the host until the OS reaps it.
 *
 * @param {string} signal — The signal name (e.g. "SIGTERM", "SIGINT").
 */
async function gracefulShutdown(signal) {
  console.log(`\n[app] Received ${signal}. Shutting down gracefully...`);

  /*
   * Step 1 — Stop accepting new HTTP connections.
   * The callback fires once all in-flight requests have finished.
   */
  server.close(async () => {
    console.log('[app] HTTP server closed.');

    /*
     * Step 2 — Close the shared Puppeteer browser.
     * This terminates the Chromium child process cleanly.
     */
    await closeBrowser();

    console.log('[app] Shutdown complete. Goodbye.');
    process.exit(0);
  });

  /*
   * Safety net: if the server hasn't closed within 10 seconds, force exit.
   * This prevents the process from hanging indefinitely if a request is
   * stuck (e.g. a very large PDF rendering).
   */
  setTimeout(() => {
    console.error('[app] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

/* Register shutdown handlers for common termination signals. */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
