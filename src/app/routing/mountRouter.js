const MOUNT_META_KEY = '__mountMeta';

const isRouter = (handler) =>
  Boolean(handler && typeof handler === 'function' && Array.isArray(handler.stack));

const flattenHandlers = (handlers) =>
  handlers.flatMap((handler) => (Array.isArray(handler) ? flattenHandlers(handler) : [handler]));

const getMountedRouters = (router) => router?.[MOUNT_META_KEY] || [];

const mountRouter = (router, path, ...handlers) => {
  const normalizedHandlers = flattenHandlers(handlers);
  router.use(path, ...normalizedHandlers);

  if (!router[MOUNT_META_KEY]) {
    router[MOUNT_META_KEY] = [];
  }

  router[MOUNT_META_KEY].push({
    path,
    handlers: normalizedHandlers,
  });

  return router;
};

module.exports = {
  isRouter,
  getMountedRouters,
  mountRouter,
};
