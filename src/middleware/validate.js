/**
 * @file validate.js — Request validation middleware
 *
 * Provides Express middleware functions that validate incoming request
 * payloads *before* they reach the route handlers.  This keeps validation
 * logic centralised and keeps the route files thin.
 *
 * Design choices:
 *   - We do manual validation instead of pulling in a library like Joi or
 *     Zod to keep the dependency tree minimal for this project.
 *   - Validation errors return HTTP 400 with a JSON body describing
 *     exactly what went wrong, making it easy for API consumers to debug.
 *
 * @module middleware/validate
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

const { listTemplates } = require('../services/templateEngine');

/* -------------------------------------------------------------------------- */
/*  Middleware functions                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Validate the request body for the POST /api/generate endpoint.
 *
 * Checks performed:
 *   1. `template` field is present and is one of the known template names.
 *   2. `data` field is present and is a non-null object.
 *
 * If validation passes the request is forwarded to the next middleware /
 * route handler via `next()`.  Otherwise a 400 response is sent immediately.
 *
 * @param {import('express').Request}  req  — Express request object.
 * @param {import('express').Response} res  — Express response object.
 * @param {import('express').NextFunction} next — Express next callback.
 * @returns {void}
 *
 * @example
 *   // In a route file:
 *   const { validateGenerateRequest } = require('../middleware/validate');
 *   router.post('/generate', validateGenerateRequest, generateHandler);
 */
function validateGenerateRequest(req, res, next) {
  const { template, data } = req.body;

  /* Collect all validation errors so we can report them in one response. */
  const errors = [];

  /* ---- Check `template` field ---- */
  if (!template) {
    errors.push('Missing required field: "template".');
  } else if (typeof template !== 'string') {
    errors.push('"template" must be a string.');
  } else {
    /*
     * Verify the requested template exists in our registry.
     * We compare against the authoritative list from the template engine
     * so adding a new template automatically makes it valid here.
     */
    const available = listTemplates();
    if (!available.includes(template)) {
      errors.push(
        `Unknown template "${template}". Available templates: ${available.join(', ')}.`
      );
    }
  }

  /* ---- Check `data` field ---- */
  if (!data) {
    errors.push('Missing required field: "data".');
  } else if (typeof data !== 'object' || Array.isArray(data)) {
    errors.push('"data" must be a JSON object (not an array or primitive).');
  }

  /* ---- Respond with errors or proceed ---- */
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors,
    });
  }

  /*
   * Validation passed — hand off to the next middleware / route handler.
   */
  next();
}

/**
 * Validate the `:name` route parameter for template-related endpoints.
 *
 * Ensures the template name in the URL corresponds to a registered
 * template.  Returns 404 if it does not.
 *
 * @param {import('express').Request}  req  — Express request object.
 * @param {import('express').Response} res  — Express response object.
 * @param {import('express').NextFunction} next — Express next callback.
 * @returns {void}
 */
function validateTemplateName(req, res, next) {
  const { name } = req.params;
  const available = listTemplates();

  if (!available.includes(name)) {
    return res.status(404).json({
      success: false,
      message: `Template "${name}" not found.`,
      availableTemplates: available,
    });
  }

  next();
}

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = {
  validateGenerateRequest,
  validateTemplateName,
};
