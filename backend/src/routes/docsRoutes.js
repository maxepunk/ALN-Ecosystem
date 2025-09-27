/**
 * API Documentation Routes
 * Serves OpenAPI spec and Swagger UI
 */
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { openApiSpec } = require('../docs/openapi.js');

const router = express.Router();

/**
 * GET /api/docs - Get OpenAPI specification
 */
router.get('/api/docs', (req, res) => {
  res.json(openApiSpec);
});

/**
 * Serve Swagger UI at /api-docs
 */
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(openApiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ALN Orchestrator API Documentation',
  customfavIcon: '/favicon.ico'
}));

module.exports = router;