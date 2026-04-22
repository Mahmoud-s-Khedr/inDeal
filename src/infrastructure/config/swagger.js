const { z } = require('zod');
const apiRoutes = require('../../app/routing');
const { discoverRouterOperations, getTagFromPath } = require('./swaggerRouteDiscovery');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'inDeal API',
    version: '1.0.0',
    description: 'OpenAPI documentation for inDeal v1 backend.',
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3000',
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
    { name: 'Support' },
    { name: 'System' },
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

const toJsonSchema = (schema) => {
  try {
    return z.toJSONSchema(schema);
  } catch {
    return { type: 'object' };
  }
};

const getValidationSchema = (middlewares) =>
  middlewares.find((middleware) => middleware?.__isValidationMiddleware)?.__validationSchema;

const hasAuthRequirement = (middlewares) =>
  middlewares.some((middleware) => middleware?.__requiresAuth === true);

const getSchemaShape = (schema) =>
  schema && typeof schema.shape === 'object' ? schema.shape : null;

const getRequiredFields = (jsonSchema) =>
  new Set(Array.isArray(jsonSchema?.required) ? jsonSchema.required : []);

const buildParameterList = (paramsSchema, querySchema, path) => {
  const parameterByKey = new Map();

  const addParameter = (parameter) => {
    const key = `${parameter.in}:${parameter.name}`;
    const existing = parameterByKey.get(key);
    if (!existing) {
      parameterByKey.set(key, parameter);
      return;
    }

    parameterByKey.set(key, {
      ...existing,
      ...parameter,
      required: existing.required || parameter.required,
    });
  };

  const pathParams = [...path.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]);
  for (const pathParamName of pathParams) {
    addParameter({
      name: pathParamName,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }

  if (paramsSchema) {
    const paramsJsonSchema = toJsonSchema(paramsSchema);
    const properties = paramsJsonSchema?.properties || {};

    for (const [name, schema] of Object.entries(properties)) {
      addParameter({
        name,
        in: 'path',
        required: true,
        schema: schema || { type: 'string' },
      });
    }
  }

  if (querySchema) {
    const queryJsonSchema = toJsonSchema(querySchema);
    const queryRequiredFields = getRequiredFields(queryJsonSchema);
    const properties = queryJsonSchema?.properties || {};

    for (const [name, schema] of Object.entries(properties)) {
      addParameter({
        name,
        in: 'query',
        required: queryRequiredFields.has(name),
        schema: schema || { type: 'string' },
      });
    }
  }

  return [...parameterByKey.values()];
};

const buildOperation = (endpoint) => {
  const validationSchema = getValidationSchema(endpoint.middlewares);
  const rootValidationSchemaJson = validationSchema ? toJsonSchema(validationSchema) : null;
  const rootRequiredFields = getRequiredFields(rootValidationSchemaJson);
  const schemaShape = validationSchema ? getSchemaShape(validationSchema) : null;

  const paramsSchema = schemaShape?.params;
  const querySchema = schemaShape?.query;
  const bodySchema = schemaShape?.body;

  const parameters = buildParameterList(paramsSchema, querySchema, endpoint.path);

  const operation = {
    tags: [getTagFromPath(endpoint.path)],
    summary: `Auto-discovered ${endpoint.method.toUpperCase()} ${endpoint.path}`,
    responses: {
      200: {
        description: 'Successful response',
      },
      400: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse',
            },
          },
        },
      },
    },
  };

  if (parameters.length) {
    operation.parameters = parameters;
  }

  if (bodySchema) {
    operation.requestBody = {
      required: rootRequiredFields.has('body'),
      content: {
        'application/json': {
          schema: toJsonSchema(bodySchema),
        },
      },
    };
  }

  if (hasAuthRequirement(endpoint.middlewares)) {
    operation.security = [{ bearerAuth: [] }];
  }

  return operation;
};

const buildPaths = () => {
  const operations = discoverRouterOperations(apiRoutes, { basePath: '/api' });
  const paths = {};

  for (const operation of operations) {
    if (!paths[operation.path]) {
      paths[operation.path] = {};
    }

    paths[operation.path][operation.method] = buildOperation(operation);
  }

  return paths;
};

const swaggerSpec = {
  ...swaggerDefinition,
  paths: buildPaths(),
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
