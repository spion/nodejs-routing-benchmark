/**
 * HTTP Server Benchmark
 * Measures actual req/s with different routing strategies
 */

const http = require('http');
const { URL } = require('url');

// Generate 100 routes
function generateRoutes() {
  const routes = [];
  const resources = ['users', 'posts', 'comments', 'products', 'orders', 'invoices', 'payments', 'reviews', 'notifications', 'messages'];
  const actions = ['list', 'create', 'update', 'delete', 'search', 'export', 'import', 'validate'];

  routes.push({ pattern: '/health', handler: 'health' });
  routes.push({ pattern: '/metrics', handler: 'metrics' });
  routes.push({ pattern: '/api/status', handler: 'status' });
  routes.push({ pattern: '/api/version', handler: 'version' });

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    routes.push({ pattern: `/api/${resource}`, handler: `list_${resource}` });
    routes.push({ pattern: `/api/${resource}/:id`, handler: `get_${resource}` });
    routes.push({ pattern: `/api/${resource}/:id/edit`, handler: `edit_${resource}` });
    routes.push({ pattern: `/api/${resource}/:id/delete`, handler: `delete_${resource}` });

    for (let j = 0; j < resources.length; j++) {
      if (i !== j && routes.length < 90) {
        const nested = resources[j];
        routes.push({ pattern: `/api/${resource}/:id/${nested}`, handler: `get_${resource}_${nested}` });
      }
    }
  }

  for (let i = 0; i < actions.length && routes.length < 100; i++) {
    routes.push({ pattern: `/api/admin/${actions[i]}`, handler: `admin_${actions[i]}` });
  }

  let fileCounter = 1;
  while (routes.length < 100) {
    routes.push({ pattern: `/static/files/file${fileCounter}.txt`, handler: `serve_file_${fileCounter}` });
    fileCounter++;
  }

  return routes;
}

const routes = generateRoutes();
const responseData = { message: 'hello world' };

/**
 * 0. Absolute Baseline - No URL parsing at all
 */
function createMinimalServer() {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });
}

/**
 * 1. Baseline - Parse URL with URL constructor, no routing
 */
function createBaselineServer() {
  const baseURL = 'http://localhost';

  return http.createServer((req, res) => {
    // Parse URL but don't route
    const url = new URL(req.url, baseURL);
    const pathname = url.pathname;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });
}

/**
 * 1b. Baseline - Manual URL parsing (string operations only)
 */
function createManualParseServer() {
  return http.createServer((req, res) => {
    // Manual URL parsing - just extract pathname
    const url = req.url;
    const queryIndex = url.indexOf('?');
    const pathname = queryIndex === -1 ? url : url.substring(0, queryIndex);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });
}

/**
 * 2. URLPattern (Optimized)
 */
function createURLPatternServer() {
  const baseURL = 'http://localhost';
  const compiledRoutes = routes.map(route => ({
    pattern: new URLPattern({
      pathname: route.pattern.replace(/:(\w+)/g, ':$1(\\w+)')
    }),
    handler: route.handler
  }));

  return http.createServer((req, res) => {
    const url = new URL(req.url, baseURL);
    const pathname = url.pathname;

    let handler = null;
    for (const route of compiledRoutes) {
      if (route.pattern.test({ pathname })) {
        handler = route.handler;
        break;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });
}

/**
 * 3. Regex-based routing
 */
function createRegexServer() {
  const baseURL = 'http://localhost';
  const compiledRoutes = routes.map(route => {
    const regexPattern = route.pattern
      .replace(/:[^/]+/g, '([^/]+)')
      .replace(/\//g, '\\/');

    return {
      regex: new RegExp(`^${regexPattern}$`),
      handler: route.handler,
      params: (route.pattern.match(/:[^/]+/g) || []).map(p => p.slice(1))
    };
  });

  return http.createServer((req, res) => {
    const url = new URL(req.url, baseURL);
    const pathname = url.pathname;

    let handler = null;
    for (const route of compiledRoutes) {
      const match = route.regex.exec(pathname);
      if (match) {
        handler = route.handler;
        break;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });
}

/**
 * 4. find-my-way
 */
function createFindMyWayServer() {
  let FindMyWay;
  try {
    FindMyWay = require('find-my-way');
  } catch (e) {
    return null;
  }

  const router = FindMyWay();

  routes.forEach(route => {
    router.on('GET', route.pattern, (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseData));
    });
  });

  return http.createServer((req, res) => {
    router.lookup(req, res);
  });
}

// Export server creation functions and routes info
module.exports = {
  createMinimalServer,
  createBaselineServer,
  createManualParseServer,
  createURLPatternServer,
  createRegexServer,
  createFindMyWayServer,
  routesCount: routes.length,
};

// If run directly, start servers on different ports
if (require.main === module) {
  const PORT_BASE = 3000;

  console.log('Starting HTTP servers for manual testing...');
  console.log(`Routes: ${routes.length}`);
  console.log('');

  const baselineServer = createBaselineServer();
  baselineServer.listen(PORT_BASE, () => {
    console.log(`1. Baseline (no routing):     http://localhost:${PORT_BASE}/health`);
  });

  const urlPatternServer = createURLPatternServer();
  urlPatternServer.listen(PORT_BASE + 1, () => {
    console.log(`2. URLPattern (optimized):    http://localhost:${PORT_BASE + 1}/health`);
  });

  const regexServer = createRegexServer();
  regexServer.listen(PORT_BASE + 2, () => {
    console.log(`3. Regex routing:             http://localhost:${PORT_BASE + 2}/health`);
  });

  const findMyWayServer = createFindMyWayServer();
  if (findMyWayServer) {
    findMyWayServer.listen(PORT_BASE + 3, () => {
      console.log(`4. find-my-way:               http://localhost:${PORT_BASE + 3}/health`);
    });
  }
}