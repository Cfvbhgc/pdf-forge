/**
 * @file errorHandler.js — Global Express error-handling middleware
 *
 * Express recognises error-handling middleware by its 4-parameter signature:
 * `(err, req, res, next)`.  This module exports a single function with that
 * signature which acts as the "catch-all" for any error thrown (or passed to
 * `next(err)`) anywhere in the middleware/route chain.
 *
 * Responsibilities:
 *   - Log the full error stack trace to the server console for debugging.
 *   - Send a structured JSON error response to the client.
 *   - Hide internal details in production (stack trace, raw message)
 *     to avoid leaking implementation information.
 *
 * @module middleware/errorHandler
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Middleware                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Global error-handling middleware for Express.
 *
 * This must be registered *after* all routes and other middleware so that
 * it catches errors from the entire request pipeline.
 *
 * @param {Error} err — The error object thrown or passed to `next(err)`.
 * @param {import('express').Request}  req  — Express request object.
 * @param {import('express').Response} res  — Express response object.
 * @param {import('express').NextFunction} _next — Express next callback
 *   (unused, but required by Express to recognise this as an error handler).
 * @returns {void}
 *
 * @example
 *   // In app.js, after all route registrations:
 *   const errorHandler = require('./middleware/errorHandler');
 *   app.use(errorHandler);
 */
function errorHandler(err, req, res, _next) {
  /*
   * Determine an appropriate HTTP status code.
   *
   * If the error (or the response) already carries a status code we use it;
   * otherwise we default to 500 Internal Server Error.
   */
  const statusCode = err.statusCode || err.status || 500;

  /*
   * Log the error on the server side so we have full context for debugging.
   * In production you would typically pipe this to a structured logging
   * service (e.g. Winston, Pino, Datadog) instead of console.error.
   */
  console.error('--- Unhandled Error ---');
  console.error(`  Path:    ${req.method} ${req.originalUrl}`);
  console.error(`  Status:  ${statusCode}`);
  console.error(`  Message: ${err.message}`);
  if (err.stack) {
    console.error(`  Stack:\n${err.stack}`);
  }
  console.error('--- End Error ---');

  /*
   * Build the JSON response body.
   *
   * In development we include the raw error message and stack trace to
   * make debugging easier.  In production we send a generic message to
   * avoid leaking internal details (file paths, library versions, etc.).
   */
  const isProduction = process.env.NODE_ENV === 'production';

  const responseBody = {
    success: false,
    message: isProduction
      ? 'An internal server error occurred.'
      : err.message || 'An internal server error occurred.',
  };

  /*
   * Include the stack trace only in non-production environments.
   * This is invaluable during local development but a security
   * concern in production.
   */
  if (!isProduction && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = errorHandler;
