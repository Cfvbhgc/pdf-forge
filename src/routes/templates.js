/**
 * @file templates.js — Template discovery and preview routes
 *
 * Provides two read-only endpoints that help API consumers discover what
 * templates are available and preview them before generating a PDF:
 *
 *   GET /api/templates           — List all templates with metadata.
 *   GET /api/templates/:name/preview — Render a template with sample data
 *                                      and return the HTML for preview.
 *
 * These endpoints don't involve Puppeteer at all — they only work with
 * the template engine, so they are fast and lightweight.
 *
 * @module routes/templates
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

const express = require('express');

const { validateTemplateName }                        = require('../middleware/validate');
const { getTemplatesMetadata, getTemplateMetadata, renderTemplate } = require('../services/templateEngine');

/* -------------------------------------------------------------------------- */
/*  Router setup                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Express Router instance mounted at `/api/templates` in app.js.
 * @type {import('express').Router}
 */
const router = express.Router();

/* -------------------------------------------------------------------------- */
/*  GET /templates                                                            */
/* -------------------------------------------------------------------------- */

/**
 * @route   GET /api/templates
 * @desc    Return a list of all available templates with their metadata
 *          (name, description, required fields, and sample data).
 * @access  Public
 *
 * @returns {Object} JSON response with `success: true` and a `templates` array.
 *
 * @example
 *   // Response:
 *   {
 *     "success": true,
 *     "templates": [
 *       {
 *         "name": "invoice",
 *         "description": "Professional invoice with itemised line items...",
 *         "requiredFields": ["companyName", "clientName", "items", "tax", "dueDate"],
 *         "sampleData": { ... }
 *       },
 *       ...
 *     ]
 *   }
 */
router.get('/', (_req, res) => {
  /*
   * Fetch metadata for every registered template.
   * The template engine maintains a registry (TEMPLATE_REGISTRY) with
   * descriptions, required field lists, and sample data for each one.
   */
  const templates = getTemplatesMetadata();

  res.json({
    success: true,
    count: templates.length,
    templates,
  });
});

/* -------------------------------------------------------------------------- */
/*  GET /templates/:name/preview                                              */
/* -------------------------------------------------------------------------- */

/**
 * @route   GET /api/templates/:name/preview
 * @desc    Render a template with its built-in sample data and return the
 *          resulting HTML.  Useful for previewing how a template looks
 *          before sending real data to POST /api/generate.
 * @access  Public
 *
 * @param {string} name — Template identifier (e.g. "invoice").
 *
 * @returns {string} The rendered HTML document (Content-Type: text/html).
 *
 * @example
 *   // Open in a browser:
 *   //   http://localhost:3003/api/templates/invoice/preview
 */
router.get('/:name/preview', validateTemplateName, (req, res, next) => {
  try {
    const { name } = req.params;

    /*
     * Look up the template metadata to get its sample data.
     * The `validateTemplateName` middleware has already confirmed that
     * `name` corresponds to a registered template, so this will not
     * return null.
     */
    const meta = getTemplateMetadata(name);

    /*
     * Render the template using the sample data.  This is the exact
     * same code path used by POST /api/generate, just with pre-defined
     * data instead of user-supplied data.
     */
    const html = renderTemplate(name, meta.sampleData);

    /*
     * Send the HTML directly.  Setting Content-Type to text/html lets
     * the browser render it as a web page, making it easy to visually
     * inspect the template.
     */
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
});

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = router;
