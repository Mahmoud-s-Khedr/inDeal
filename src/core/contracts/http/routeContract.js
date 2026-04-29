const routeContract = (contract) => {
  const middleware = (req, res, next) => next();
  middleware.__isRouteContractMiddleware = true;
  middleware.__routeContract = contract || {};
  return middleware;
};

module.exports = routeContract;
