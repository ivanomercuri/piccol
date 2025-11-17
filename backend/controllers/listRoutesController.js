/**
 * Extracts all routes from an Express 5.1.0 app or Router.
 * If options.format = true, returns an array of formatted strings;
 * otherwise returns an array of { method, route, middlewares }.
 *
 * @param {import('express').Application|import('express').Router} appOrRouter
 * @param {{ format?: boolean }} options
 * @returns {Array<{ method: string, route: string, middlewares: string[] }> | string[]}
 *
function listRoutes(appOrRouter, options = {}){
    const routes = [];
    const root = appOrRouter.router || appOrRouter;
    const stack = root.stack || [];

    // Try to recover a real function name, even from anonymous/factory fns
    function getMiddlewareName(fn) {
        if (fn.name) return fn.name;
        const m = /^function\s*([\w$]+)/.exec(fn.toString());
        return m ? m[1] : "<anonymous>";
    }

    // Join two URL segments, ensuring exactly one "/" between them
    function joinPaths(a, b) {
        if (!b) return a;
        const A = a.endsWith("/") ? a.slice(0, -1) : a;
        const B = b.startsWith("/") ? b : "/" + b;
        return A + B;
    }

    // Given any Layer, figure out its "mount path" portion:
    //  • layer.path (Express 5 sets this on .use)
    //  • layer.route.path (for route layers)
    //  • fallback: parse layer.regexp.toString()
    function getLayerPath(layer) {
        if (layer.path != null) {
            return layer.path === "/" ? "" : layer.path;
        }
        if (layer.route && layer.route.path != null) {
            return layer.route.path === "/" ? "" : layer.route.path;
        }
        if (layer.regexp) {
            // fast_slash means "/"
            if (layer.regexp.fast_slash) return "";
            // strip off the /^  \/foo  \/?(?=\/|$) /i wrapper
            let str = layer.regexp
                .toString()
                .replace(/^\/\^/, "")
                .replace(/\\\/\?\(\?=\\\/\|\$\)\/i$/, "")
                .replace(/\\\//g, "/")
                .replace(/\\\./g, ".");
            // replace capture groups with :param
            const keys = (layer.keys || []).map((k) => `:${k.name}`);
            str = str.replace(/\((?:\?:)?[^\)]+\)/g, () => keys.shift() || "");
            return str.startsWith("/") ? str : "/" + str;
        }
        return "";
    }

    /**
     * Recursively walk a stack of Layers, accumulating:
     *  - `prefix` the URL so far ("/v7", then "/v7/webhooks", etc.)
     *  - `parentMW` the array of middleware names mounted above this point
     *
    function traverse(stack, prefix = "", parentMW = []) {
        stack.forEach((layer, idx) => {
            // ─── Case 1: a direct route (app.get / router.post / etc) ───
            if (layer.route) {
                const routePath = layer.route.path || "";
                const fullPath = joinPaths(prefix, routePath);
                const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
                const routeMW = layer.route.stack.map((l) => getMiddlewareName(l.handle));
                const allMW = parentMW.concat(routeMW);

                methods.forEach((method) => {
                    routes.push({ method, route: fullPath, middlewares: allMW });
                });

                // ─── Case 2: a mounted router or .use(path, fn, ...) block ───
            } else if (layer.handle && layer.handle.stack) {
                const mountPath = getLayerPath(layer);
                const fullPref = joinPaths(prefix, mountPath);

                // gather any plain middleware functions mounted at this same mountPath
                const mountMW = stack
                    .slice(0, idx)
                    .filter(
                        (prev) =>
                            typeof prev.handle === "function" &&
                            !prev.handle.stack && // not a router
                            getLayerPath(prev) === mountPath // same mount path
                    )
                    .map((prev) => getMiddlewareName(prev.handle));

                // recurse into child stack, carrying forward middleware names
                traverse(layer.handle.stack, fullPref, parentMW.concat(mountMW));
            }
            // else: a logger, error handler, or global middleware—skip it
        });
    }

    traverse(stack);

    // If asked for formatted strings, pad each column to align the dashes
    if (options.format) {
        const idxW = String(routes.length).length;
        const mthW = Math.max(...routes.map((r) => r.method.length), 6);
        const rteW = Math.max(...routes.map((r) => r.route.length), 5);

        return routes.map((r, i) => {
            const idx = String(i + 1).padEnd(idxW, " ");
            const mtd = r.method.padEnd(mthW, " ");
            const rte = r.route.padEnd(rteW, " ");
            const mws = r.middlewares.join(", ");
            return `${idx} - ${mtd} - ${rte} - ${mws}`;
        });
    }

    return routes;
}
*/

function printRegisteredRoutes(routerStack, parentPath = '') {
    routerStack.forEach((middleware) => {
        if (middleware.route) {
            console.debug(
                middleware.route.stack[0].method.toUpperCase(),
                `${parentPath}${middleware.route.path}`
            );
        } else if (middleware.name === 'router') {
            printRegisteredRoutes(
                middleware.handle.stack,
                `${parentPath}${middleware.path}`
            );
        }
    });
}

module.exports = {
    listRoutes: (req, res) => {
        if (process.env.SHOW_ROUTES !== 'true') {
            return res.error(403, 'Accesso negato');
        }

        const app = req.app;
        //const routes = listRoutes(app);
        printRegisteredRoutes(app.router.stack);
        return res.success([]);
    }
};