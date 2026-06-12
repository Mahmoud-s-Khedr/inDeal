const routeContract = (contract) => {
  const routeContractMiddleware = (req, res, next) => next();
  routeContractMiddleware.__isRouteContractMiddleware = true;
  routeContractMiddleware.__routeContract = contract || {};
  return routeContractMiddleware;
};

module.exports = routeContract;
