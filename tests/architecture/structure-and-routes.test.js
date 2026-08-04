require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { swaggerSpec } = require('../../src/infrastructure/config/swagger');
const {
  docsRequestSchemas: dealDocsRequestSchemas,
} = require('../../src/core/contracts/http/modules/deal.contracts');
const dealRouter = require('../../src/modules/deal/routes/deal.routes');

const root = path.resolve(__dirname, '../../src');

const domains = ['auth', 'company', 'deal', 'chat', 'file', 'system', 'health'];

test('legacy layered folders are removed', () => {
  const legacy = [
    'controllers',
    'services',
    'repositories',
    'routes',
    'middlewares',
    'utils',
    'config',
  ];
  for (const dir of legacy) {
    assert.equal(fs.existsSync(path.join(root, dir)), false, `${dir} should not exist in src/`);
  }
});

test('each core module exposes index and expected folders', () => {
  for (const domain of domains) {
    const base = path.join(root, 'modules', domain);
    assert.equal(fs.existsSync(path.join(base, 'index.js')), true, `${domain} index.js missing`);
    assert.equal(fs.existsSync(path.join(base, 'routes')), true, `${domain} routes missing`);
    assert.equal(
      fs.existsSync(path.join(base, 'controller')),
      true,
      `${domain} controller missing`
    );
  }
});

test('route registry still exposes v1 endpoint groups', () => {
  const endpoints = Object.keys(swaggerSpec.paths || {});

  const requiredPrefixes = [
    '/api/v1/health',
    '/api/v1/system',
    '/api/v1/auth',
    '/api/v1/companies',
    '/api/v1/files',
    '/api/v1/users',
    '/api/v1/deals',
    '/api/v1/chats',
  ];

  for (const prefix of requiredPrefixes) {
    const found = endpoints.some((pathItem) => pathItem.startsWith(prefix));
    assert.equal(found, true, `Missing endpoint prefix: ${prefix}`);
  }
});

test('deals search route keeps public access with optional auth context', () => {
  const searchRouteLayer = dealRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/' && layer.route.methods.get
  );

  assert.ok(searchRouteLayer, 'GET /deals route missing');
  const middlewareNames = searchRouteLayer.route.stack.map((layer) => layer.handle.name);
  assert.deepEqual(middlewareNames, ['optionalAuth', 'routeContractMiddleware', 'validator', '']);
});

test('deal request routes expose direct inbox and update endpoint', () => {
  const directInboxRoute = dealRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/me/direct-requests' && layer.route.methods.get
  );
  const updateRoute = dealRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/requests/:requestId' && layer.route.methods.put
  );

  assert.ok(directInboxRoute, 'GET /deals/me/direct-requests route missing');
  assert.ok(updateRoute, 'PUT /deals/requests/:requestId route missing');
});

test('swagger request schemas are restored for date-based endpoints', () => {
  const cases = [
    {
      method: 'post',
      path: '/api/v1/auth/register',
      assertOperation: (operation) => {
        const body = operation.requestBody.content['application/json'].schema;
        assert.ok(body.properties.user, 'register should expose user in request body');
        assert.ok(body.properties.company, 'register should expose company in request body');
      },
    },
    {
      method: 'post',
      path: '/api/v1/auth/resubmit',
      assertOperation: (operation) => {
        const body = operation.requestBody.content['application/json'].schema;
        assert.ok(body.properties.documents, 'resubmit should expose documents in request body');
      },
    },
    {
      method: 'post',
      path: '/api/v1/companies/me/documents',
      assertOperation: (operation) => {
        const body = operation.requestBody.content['application/json'].schema;
        assert.equal(body.properties.issueDate.type, 'string');
        assert.equal(body.properties.issueDate.format, 'date-time');
        assert.equal(body.properties.expiryDate.type, 'string');
        assert.equal(body.properties.expiryDate.format, 'date-time');
      },
    },
    {
      method: 'put',
      path: '/api/v1/companies/me/documents/{documentId}',
      assertOperation: (operation) => {
        const body = operation.requestBody.content['application/json'].schema;
        const pathParams = (operation.parameters || []).filter(
          (parameter) => parameter.in === 'path'
        );
        assert.ok(body.properties.issueDate, 'document update should expose issueDate');
        assert.ok(pathParams.some((parameter) => parameter.name === 'documentId'));
      },
    },
    {
      method: 'get',
      path: '/api/v1/deals',
      assertOperation: (operation) => {
        const queryParams = Object.fromEntries(
          (operation.parameters || []).map((parameter) => [parameter.name, parameter])
        );
        assert.equal(queryParams.createdFrom.schema.type, 'string');
        assert.equal(queryParams.createdFrom.schema.format, 'date-time');
        assert.equal(queryParams.createdTo.schema.type, 'string');
        assert.equal(queryParams.createdTo.schema.format, 'date-time');
      },
    },
    {
      method: 'post',
      path: '/api/v1/deals/direct-requests',
      assertOperation: (operation) => {
        const body = operation.requestBody.content['application/json'].schema;
        const requiredSupplyFields = [
          'quantityRequired',
          'deliveryLocation',
          'deliveryDate',
          'targetPrice',
          'currency',
          'keySpecifications',
          'maxLeadTimeAccepted',
          'deliveryMethodPreference',
        ];
        assert.equal(body.properties.supplyDetails.properties.deliveryDate.type, 'string');
        assert.equal(body.properties.supplyDetails.properties.deliveryDate.format, 'date-time');
        for (const field of requiredSupplyFields) {
          assert.ok(body.properties.supplyDetails.required.includes(field));
        }
      },
    },
    {
      method: 'post',
      path: '/api/v1/deals/{id}/requests',
      assertOperation: (operation) => {
        const body = operation.requestBody.content['application/json'].schema;
        const pathParams = (operation.parameters || []).filter(
          (parameter) => parameter.in === 'path'
        );
        const requiredDemandFields = [
          'availableQuantity',
          'offerValidityDays',
          'unitPrice',
          'currency',
          'moq',
          'availabilityType',
          'specsMatchRfq',
          'materialOffered',
          'dimensions',
          'paymentTerms',
          'deliveryTerms',
        ];
        assert.equal(body.properties.supplyDetails.properties.deliveryDate.type, 'string');
        assert.equal(body.properties.supplyDetails.properties.deliveryDate.format, 'date-time');
        for (const field of requiredDemandFields) {
          assert.ok(body.properties.demandDetails.required.includes(field));
        }
        assert.ok(pathParams.some((parameter) => parameter.name === 'id'));
      },
    },
  ];

  for (const { method, path, assertOperation } of cases) {
    const operation = swaggerSpec.paths?.[path]?.[method];
    assert.ok(operation, `Missing ${method.toUpperCase()} ${path} in swagger`);
    const bodySchema = operation.requestBody?.content?.['application/json']?.schema;
    if (bodySchema) {
      assert.notDeepEqual(
        bodySchema,
        { type: 'object' },
        `${method.toUpperCase()} ${path} has generic request body`
      );
    }
    assertOperation(operation);
  }
});

test('deal docs request schemas remain JSON-schema serializable', () => {
  assert.doesNotThrow(() => z.toJSONSchema(dealDocsRequestSchemas.updateDealRequestSchema));
});
