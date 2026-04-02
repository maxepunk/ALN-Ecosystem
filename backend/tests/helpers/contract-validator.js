/**
 * Unified contract validation for HTTP and WebSocket APIs
 * Validates responses/events against OpenAPI/AsyncAPI schemas
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Initialize ajv with formats (dates, uris, etc.)
const ajv = new Ajv({
  strict: false,  // Allow additional properties (flexible for optional fields)
  allErrors: true // Show all validation errors, not just first
});
addFormats(ajv);

// Load contracts once
const openapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../contracts/openapi.yaml'), 'utf8')
);
const asyncapi = yaml.load(
  fs.readFileSync(path.join(__dirname, '../../contracts/asyncapi.yaml'), 'utf8')
);

// Register OpenAPI component schemas with ajv (so $ref resolution works)
if (openapi.components && openapi.components.schemas) {
  Object.entries(openapi.components.schemas).forEach(([name, schema]) => {
    ajv.addSchema(schema, `#/components/schemas/${name}`);
  });
}

// Register AsyncAPI component schemas with ajv (so $ref resolution works)
if (asyncapi.components && asyncapi.components.schemas) {
  Object.entries(asyncapi.components.schemas).forEach(([name, schema]) => {
    ajv.addSchema(schema, `#/components/schemas/${name}`);
  });
}

/**
 * Extract schema from OpenAPI spec
 */
function getHTTPSchema(path, method, status = '200') {
  const pathSpec = openapi.paths[path];
  if (!pathSpec) throw new Error(`Path ${path} not found in OpenAPI spec`);

  const methodSpec = pathSpec[method.toLowerCase()];
  if (!methodSpec) throw new Error(`Method ${method} not found for ${path}`);

  const responseSpec = methodSpec.responses[status];
  if (!responseSpec) throw new Error(`Response ${status} not found for ${method} ${path}`);

  return responseSpec.content['application/json'].schema;
}

/**
 * Extract schema from AsyncAPI spec
 */
function getWebSocketSchema(eventName) {
  // AsyncAPI 2.6: All messages are in components/messages, find by 'name' field
  const messages = asyncapi.components.messages;

  // Find message with matching name
  const message = Object.values(messages).find(msg => msg.name === eventName);

  if (!message) {
    throw new Error(`Event ${eventName} not found in AsyncAPI spec`);
  }

  return message.payload;
}

/**
 * Validate HTTP response against OpenAPI contract
 */
function validateHTTPResponse(response, path, method, expectedStatus = 200) {
  const schema = getHTTPSchema(path, method, expectedStatus.toString());
  const validate = ajv.compile(schema);
  const valid = validate(response.body);

  if (!valid) {
    throw new Error(
      `HTTP response validation failed for ${method} ${path}:\n` +
      JSON.stringify(validate.errors, null, 2)
    );
  }

  return true;
}

/**
 * Validate WebSocket event against AsyncAPI contract
 */
function validateWebSocketEvent(eventData, eventName) {
  const schema = getWebSocketSchema(eventName);
  const validate = ajv.compile(schema);
  const valid = validate(eventData);

  if (!valid) {
    throw new Error(
      `WebSocket event validation failed for ${eventName}:\n` +
      JSON.stringify(validate.errors, null, 2)
    );
  }

  return true;
}

/**
 * Extract REQUEST body schema from OpenAPI spec
 * @param {string} path - OpenAPI path (e.g., '/api/scan')
 * @param {string} method - HTTP method (e.g., 'post')
 * @returns {object} JSON Schema for the request body
 */
function getHTTPRequestSchema(path, method) {
  const pathSpec = openapi.paths[path];
  if (!pathSpec) throw new Error(`Path ${path} not found in OpenAPI spec`);

  const methodSpec = pathSpec[method.toLowerCase()];
  if (!methodSpec) throw new Error(`Method ${method} not found for ${path}`);

  const requestBody = methodSpec.requestBody;
  if (!requestBody) throw new Error(`No requestBody defined for ${method} ${path}`);

  return requestBody.content['application/json'].schema;
}

/**
 * Validate a request body against OpenAPI request schema
 * @param {object} body - Request body to validate
 * @param {string} path - OpenAPI path
 * @param {string} method - HTTP method
 * @returns {boolean} true if valid
 * @throws {Error} if validation fails with detailed errors
 */
function validateHTTPRequest(body, path, method) {
  const schema = getHTTPRequestSchema(path, method);
  const validate = ajv.compile(schema);
  const valid = validate(body);

  if (!valid) {
    throw new Error(
      `HTTP request validation failed for ${method.toUpperCase()} ${path}:\n` +
      JSON.stringify(validate.errors, null, 2)
    );
  }

  return true;
}

module.exports = {
  validateHTTPResponse,
  validateHTTPRequest,
  validateWebSocketEvent,
  getHTTPSchema,
  getHTTPRequestSchema,
  getWebSocketSchema
};
