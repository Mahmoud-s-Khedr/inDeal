const { buildOpenApiPathsFromContracts } = require('../../core/contracts/http/registry');
const { getTagFromPath } = require('./swaggerRouteDiscovery');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'inDeal API',
    version: '1.0.0',
    description: 'OpenAPI documentation for inDeal v1 backend.',
  },
  servers: [
    {
      url: process.env.API_BASE_URL || '/',
      description: 'Default server',
    },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Companies' },
    { name: 'Deals' },
    { name: 'Chats' },
    { name: 'Files' },
    { name: 'Users' },
    { name: 'System' },
    { name: 'Search' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'error',
          },
          message: {
            type: 'string',
            example: 'Something went wrong',
          },
        },
      },
    },
  },
};

const swaggerSpec = {
  ...swaggerDefinition,
  paths: buildOpenApiPathsFromContracts({ getTagFromPath }),
};

const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
  },
};

module.exports = {
  swaggerSpec,
  swaggerUiOptions,
};
