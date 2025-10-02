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
  const channel = asyncapi.channels[eventName];
  if (!channel) throw new Error(`Event ${eventName} not found in AsyncAPI spec`);

  return channel.publish.message.payload;
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

module.exports = {
  validateHTTPResponse,
  validateWebSocketEvent,
  getHTTPSchema,
  getWebSocketSchema
};
