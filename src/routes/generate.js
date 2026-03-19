/**
 * @file generate.js — PDF generation route
 *
 * Defines the POST /api/generate endpoint which is the core feature of
 * PDF Forge.  The endpoint accepts a JSON body specifying which template
 * to use and what data to inject, renders the template to HTML, converts
 * the HTML to a PDF via Puppeteer, and streams the resulting PDF back to
 * the client.
 *
 * Request flow:
 *   1. Client sends POST /api/generate with JSON body.
 *   2. `validateGenerateRequest` middleware checks the payload.
 *   3. Route handler renders the template with the supplied data.
 *   4. pdfService converts the HTML to a PDF buffer.
 *   5. The buffer is sent as the response with Content-Type: application/pdf.
 *
 * @module routes/generate
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

const express = require('express');

const { validateGenerateRequest } = require('../middleware/validate');
const { renderTemplate }          = require('../services/templateEngine');
const { generatePdf }             = require('../services/pdfService');

/* -------------------------------------------------------------------------- */
/*  Router setup                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Express Router instance that will be mounted at `/api` in app.js.
 * @type {import('express').Router}
 */
const router = express.Router();

/* -------------------------------------------------------------------------- */
/*  POST /generate                                                            */
/* -------------------------------------------------------------------------- */

/**
 * @route   POST /api/generate
 * @desc    Generate a PDF from a named template and user-supplied data.
 * @access  Public
 *
 * @body {Object} request body
 * @body {string} request.template — Name of the template to use
 *   (e.g. "invoice", "report", "resume", "certificate").
 * @body {Object} request.data — Key-value pairs to substitute into the template.
 * @body {Object} [request.pdfOptions] — Optional Puppeteer PDF overrides
 *   (format, margin, landscape, etc.).
 *
 * @returns {Buffer} The generated PDF file with Content-Type: application/pdf.
 *
 * @example
 *   // cURL example:
 *   curl -X POST http://localhost:3003/api/generate \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "template": "invoice",
 *       "data": {
 *         "companyName": "Acme Corp",
 *         "clientName": "Jane Smith",
 *         "items": [{ "name": "Consulting", "qty": 10, "price": 150 }],
 *         "tax": 10,
 *         "dueDate": "2026-04-30"
 *       }
 *     }' \
 *     --output invoice.pdf
 */
router.post('/generate', validateGenerateRequest, async (req, res, next) => {
  try {
    const { template, data, pdfOptions } = req.body;

    /*
     * Step 1 — Render the HTML template with the provided data.
     *
     * The template engine loads the HTML file from disk, pre-processes
     * complex fields (arrays → HTML fragments), and replaces all
     * {{placeholder}} tokens with actual values.
     */
    console.log(`[generate] Rendering template: ${template}`);
    const html = renderTemplate(template, data);

    /*
     * Step 2 — Convert the rendered HTML to a PDF via Puppeteer.
     *
     * This opens a Chromium tab, sets the HTML content, waits for
     * any embedded resources to load, and captures a PDF buffer.
     */
    console.log(`[generate] Generating PDF...`);
    const pdfBuffer = await generatePdf(html, pdfOptions || {});
    console.log(`[generate] PDF generated (${pdfBuffer.length} bytes).`);

    /*
     * Step 3 — Send the PDF back to the client.
     *
     * Headers:
     *   Content-Type        — tells the browser this is a PDF.
     *   Content-Disposition — suggests a filename for download.
     *   Content-Length      — lets the client show a progress bar.
     */
    const filename = `${template}-${Date.now()}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    /*
     * Forward any errors to the global error handler so they are
     * logged and returned as a structured JSON response.
     */
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = router;
