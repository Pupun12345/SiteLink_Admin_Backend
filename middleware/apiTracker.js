let apiRequestTracker = {
  requests: [],
  errors: [],
  startTime: Date.now()
};

const trackApiRequest = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    const requestData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    apiRequestTracker.requests.push(requestData);
    if (apiRequestTracker.requests.length > 1000) {
      apiRequestTracker.requests.shift();
    }

    if (res.statusCode >= 400) {
      apiRequestTracker.errors.push(requestData);
      if (apiRequestTracker.errors.length > 100) {
        apiRequestTracker.errors.shift();
      }
    }
  });

  next();
};

module.exports = {
  trackApiRequest,
  apiRequestTracker
};