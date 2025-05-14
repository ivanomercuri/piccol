
const app = require('../index');
const printed = new Set(); // Set to keep track of already printed routes

// Recursively prints all routes in the Express app
function print(path, layer) {
  if (layer.route) {
    // If the layer is a route, iterate over its stack
    layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))))
  } else if (layer.name === 'router' && layer.handle.stack) {
    // If the layer is a router, iterate over its stack
    layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))))
  } else if (layer.method) {
    // If the layer is a method (HTTP verb), print the route if not already printed
    const route = `${layer.method.toUpperCase()} /${path.concat(split(layer.regexp)).filter(Boolean).join('/')}`;
    if (!printed.has(route)) {
      console.log(route);
      printed.add(route);
    }
  }
}

// Splits a route path or regexp into parts for easier processing
function split(thing) {
  if (typeof thing === 'string') {
    return thing.split('/');
  } else if (thing.fast_slash) {
    // Special case for fast_slash property
    return '';
  } else {
    // Handles regular expressions for route paths
    let match = thing.toString()
      .replace('\\/?', '')
      .replace('(?=\\/|$)', '$')
      .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//)
    return match
      ? match[1].replace(/\\(.)/g, '$1').split('/')
      : '<complex:' + thing.toString() + '>';
  }
}

// Start printing all routes from the app's router stack
app._router.stack.forEach(print.bind(null, []));
