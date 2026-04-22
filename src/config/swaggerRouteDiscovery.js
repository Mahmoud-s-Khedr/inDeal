const { getMountedRouters, isRouter } = require('../routes/mountRouter');

const tagBySegment = {
  health: 'Health',
  auth: 'Auth',
  companies: 'Companies',
  deals: 'Deals',
  chats: 'Chats',
  files: 'Files',
  users: 'Users',
  support: 'Support',
  system: 'System',
};

const trimTrailingSlash = (value) => (value.length > 1 ? value.replace(/\/+$/g, '') : value);

const joinPaths = (basePath, nextPath) => {
  const base = basePath || '';
  const next = nextPath || '';
  const joined = `${base}/${next}`.replace(/\/{2,}/g, '/');
  const normalized = joined.startsWith('/') ? joined : `/${joined}`;
  return trimTrailingSlash(normalized);
};

const normalizeOpenApiPath = (path) => joinPaths('', path).replace(/:([A-Za-z0-9_]+)/g, '{$1}');

const getTagFromPath = (path) => {
  const segments = path.split('/').filter(Boolean);
  const v1Index = segments.indexOf('v1');
  const tagKey = v1Index >= 0 ? segments[v1Index + 1] : undefined;
  return tagBySegment[tagKey] || 'System';
};

const getRouterMiddlewares = (router) => {
  const stack = Array.isArray(router?.stack) ? router.stack : [];
  const middlewares = [];

  for (const layer of stack) {
    if (layer?.route) {
      continue;
    }

    const handler = layer?.handle;
    if (!handler || isRouter(handler)) {
      continue;
    }

    middlewares.push(handler);
  }

  return middlewares;
};

const getRouteLayers = (router) => {
  const stack = Array.isArray(router?.stack) ? router.stack : [];
  return stack.filter((layer) => layer?.route);
};

const discoverRouterOperations = (rootRouter, options = {}) => {
  const basePath = options.basePath || '';
  const operations = [];

  const walk = (router, pathPrefix, inheritedMiddlewares) => {
    if (!router) {
      return;
    }

    const routerMiddlewares = getRouterMiddlewares(router);
    const activeInheritedMiddlewares = [...inheritedMiddlewares, ...routerMiddlewares];

    for (const layer of getRouteLayers(router)) {
      const route = layer.route;
      const routePaths = Array.isArray(route.path) ? route.path : [route.path];
      const methods = Object.entries(route.methods || {})
        .filter(([, enabled]) => Boolean(enabled))
        .map(([method]) => method.toLowerCase());
      const routeMiddlewares = Array.isArray(route.stack)
        ? route.stack.map((entry) => entry.handle).filter(Boolean)
        : [];

      for (const routePath of routePaths) {
        const combinedPath = joinPaths(pathPrefix, routePath);
        const openApiPath = normalizeOpenApiPath(combinedPath);

        for (const method of methods) {
          operations.push({
            method,
            path: openApiPath,
            middlewares: [...activeInheritedMiddlewares, ...routeMiddlewares],
          });
        }
      }
    }

    const mounts = getMountedRouters(router);
    for (const mount of mounts) {
      const handlers = Array.isArray(mount.handlers) ? mount.handlers : [];
      const mountMiddlewares = handlers.filter((handler) => !isRouter(handler));
      const childRouters = handlers.filter((handler) => isRouter(handler));
      const childPathPrefix = joinPaths(pathPrefix, mount.path);
      const nextInheritedMiddlewares = [...activeInheritedMiddlewares, ...mountMiddlewares];

      for (const childRouter of childRouters) {
        walk(childRouter, childPathPrefix, nextInheritedMiddlewares);
      }
    }
  };

  walk(rootRouter, basePath, []);

  return operations.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method);
    }
    return a.path.localeCompare(b.path);
  });
};

module.exports = {
  discoverRouterOperations,
  getTagFromPath,
  normalizeOpenApiPath,
};
