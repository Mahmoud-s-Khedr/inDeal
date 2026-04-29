const { z } = require('zod');
const {
  discoverRouterOperations,
  normalizeOpenApiPath,
} = require('../../../infrastructure/config/swaggerRouteDiscovery');
const { defaultRequestSchema, defaultResponseSchema } = require('./schemas');

const contractByOperation = new Map();
const manualContractByOperation = new Map();
let initialized = false;

const toJsonSchema = (schema) => {
  try {
    return z.toJSONSchema(schema);
  } catch {
    return { type: 'object' };
  }
};

const normalizeMethod = (method) => String(method || '').toLowerCase();
const methodAllowsRequestBody = (method) => !['get', 'head'].includes(normalizeMethod(method));
const hasBodyFieldInRequestSchema = (requestSchema) =>
  !!(
    requestSchema &&
    typeof requestSchema.shape === 'object' &&
    requestSchema.shape !== null &&
    requestSchema.shape.body
  );

const operationKey = (method, path) => `${normalizeMethod(method)} ${normalizeOpenApiPath(path)}`;

const getValidationSchema = (middlewares) =>
  middlewares.find((middleware) => middleware?.__isValidationMiddleware)?.__validationSchema;

const getRouteContractOverride = (middlewares) =>
  middlewares.find((middleware) => middleware?.__isRouteContractMiddleware)?.__routeContract;

const hasAuthRequirement = (middlewares) =>
  middlewares.some((middleware) => middleware?.__requiresAuth === true);

const buildContract = (operation) => {
  const override = getRouteContractOverride(operation.middlewares) || {};
  const requestSchema =
    override.requestSchema || getValidationSchema(operation.middlewares) || defaultRequestSchema;
  const successResponseSchema = override.successResponseSchema || defaultResponseSchema;

  return {
    method: operation.method,
    path: operation.path,
    requestSchema,
    successResponseSchema,
    errorResponseSchema: override.errorResponseSchema,
    tag: override.tag,
    auth: override.auth ?? hasAuthRequirement(operation.middlewares),
    responses: override.responses,
  };
};

const ensureInitialized = () => {
  if (initialized) return;

  // Lazy load to avoid init cycles during module import.
  const apiRoutes = require('../../../app/routing');
  const operations = discoverRouterOperations(apiRoutes, { basePath: '/api' });

  for (const operation of operations) {
    const key = operationKey(operation.method, operation.path);
    contractByOperation.set(key, buildContract(operation));
  }

  initialized = true;
};

const getAllHttpContracts = () => {
  ensureInitialized();
  const merged = new Map(contractByOperation);
  for (const [key, value] of manualContractByOperation.entries()) {
    merged.set(key, value);
  }
  return [...merged.values()];
};

const getHttpContract = (method, path) => {
  const key = operationKey(method, path);
  if (manualContractByOperation.has(key)) {
    return manualContractByOperation.get(key);
  }
  ensureInitialized();
  return contractByOperation.get(key);
};

const getHttpContractForRequest = (req) => {
  if (!req?.route) return null;
  const mounted = `${req.baseUrl || ''}${req.route.path || ''}`;
  return getHttpContract(req.method, mounted);
};

const setHttpContract = (method, path, contract) => {
  const key = operationKey(method, path);
  const current = manualContractByOperation.get(key) || {
    method: normalizeMethod(method),
    path: normalizeOpenApiPath(path),
  };
  manualContractByOperation.set(key, { ...current, ...contract });
};

const buildOpenApiPathsFromContracts = ({ getTagFromPath }) => {
  const paths = {};

  for (const contract of getAllHttpContracts()) {
    if (!paths[contract.path]) {
      paths[contract.path] = {};
    }

    const requestJson = toJsonSchema(contract.requestSchema);
    const paramsProps = requestJson?.properties?.params?.properties || {};
    const queryProps = requestJson?.properties?.query?.properties || {};
    const bodySchema = requestJson?.properties?.body;

    const queryRequired = new Set(requestJson?.properties?.query?.required || []);

    const parameters = [];
    for (const [name, schema] of Object.entries(paramsProps)) {
      parameters.push({ name, in: 'path', required: true, schema: schema || { type: 'string' } });
    }
    for (const [name, schema] of Object.entries(queryProps)) {
      parameters.push({
        name,
        in: 'query',
        required: queryRequired.has(name),
        schema: schema || { type: 'string' },
      });
    }

    const successResponseSchema = toJsonSchema(contract.successResponseSchema);

    const operation = {
      tags: [contract.tag || getTagFromPath(contract.path)],
      summary: `Auto-discovered ${contract.method.toUpperCase()} ${contract.path}`,
      responses: {
        200: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: successResponseSchema,
            },
          },
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

    if (parameters.length) operation.parameters = parameters;
    if (
      methodAllowsRequestBody(contract.method) &&
      (bodySchema || hasBodyFieldInRequestSchema(contract.requestSchema))
    ) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: bodySchema || { type: 'object' },
          },
        },
      };
    }

    if (contract.auth) {
      operation.security = [{ bearerAuth: [] }];
    }

    if (contract.responses && typeof contract.responses === 'object') {
      operation.responses = { ...operation.responses, ...contract.responses };
    }

    paths[contract.path][contract.method] = operation;
  }

  return paths;
};

module.exports = {
  getAllHttpContracts,
  getHttpContract,
  getHttpContractForRequest,
  setHttpContract,
  buildOpenApiPathsFromContracts,
};
