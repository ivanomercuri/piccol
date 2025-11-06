function getRoutes(app) {
  const routes = [];
  function print(path, layer) {
    if (layer.route) {
      layer.route.stack.forEach(print.bind(null, path.concat(split(layer.route.path))));
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(print.bind(null, path.concat(split(layer.regexp))));
    } else if (layer.method) {
      const route = `${layer.method.toUpperCase()} /${path.concat(split(layer.regexp)).filter(Boolean).join('/')}`;
      routes.push(route);
    }
  }
  function split(thing) {
    if (typeof thing === 'string') return thing.split('/');
    if (thing.fast_slash) return '';
    let match = thing.toString()
      .replace('\\/?', '')
      .replace('(?=\\/|$)', '$')
        .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
    return match ? match[1].replace(/\\(.)/g, '$1').split('/') : [];
  }
  app._router.stack.forEach(print.bind(null, []));
  return Array.from(new Set(routes));
}
module.exports = {
  listRoutes: (req, res) => {
    if (process.env.SHOW_ROUTES !== 'true') {
      return res.error(403, 'Accesso negato');
    }
    const app = require('../index');
    const routes = getRoutes(app);
    return res.success(routes);
  }
};