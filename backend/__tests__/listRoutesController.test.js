// listRoutesController espone /routes, gated dalla variabile d'ambiente
// SHOW_ROUTES. Era privo di test, compreso il dettaglio poco intuitivo per
// cui la risposta HTTP è sempre un array vuoto anche quando la route è
// abilitata: l'elenco route viene solo stampato su console, mai restituito
// nel body (vedi backend/docs/API.md).
const { listRoutes } = require('../controllers/listRoutesController');

describe('listRoutesController.listRoutes', () => {
  const originalShowRoutes = process.env.SHOW_ROUTES;

  afterEach(() => {
    // Ripristiniamo il valore originale per non "sporcare" altri test che
    // potrebbero girare nello stesso processo Jest.
    process.env.SHOW_ROUTES = originalShowRoutes;
  });

  it('should return 403 when SHOW_ROUTES is not exactly "true"', () => {
    process.env.SHOW_ROUTES = 'false';

    const res = { success: jest.fn(), error: jest.fn() };

    listRoutes({ app: { router: { stack: [] } } }, res);

    expect(res.error).toHaveBeenCalledWith(403, 'Accesso negato');

    expect(res.success).not.toHaveBeenCalled();
  });

  it('should return 403 when SHOW_ROUTES is unset', () => {
    delete process.env.SHOW_ROUTES;

    const res = { success: jest.fn(), error: jest.fn() };

    listRoutes({ app: { router: { stack: [] } } }, res);

    expect(res.error).toHaveBeenCalledWith(403, 'Accesso negato');
  });

  it('should respond with an empty array when SHOW_ROUTES is "true", even though routes exist', () => {
    // Il corpo della risposta NON contiene mai l'elenco delle route: qui
    // simuliamo uno stack Express con una route reale per dimostrare che,
    // anche in quel caso, res.success viene comunque chiamato con [].
    process.env.SHOW_ROUTES = 'true';

    const res = { success: jest.fn(), error: jest.fn() };

    const fakeRouterStack = [
      {
        route: {
          path: '/products',
          stack: [{ method: 'get' }],
        },
      },
    ];

    listRoutes({ app: { router: { stack: fakeRouterStack } } }, res);

    expect(res.success).toHaveBeenCalledWith([]);

    expect(res.error).not.toHaveBeenCalled();
  });

  it('should not throw when recursing into a nested router in the stack', () => {
    // printRegisteredRoutes si richiama ricorsivamente sui router annidati
    // (es. adminRoutes che monta userRoutes): verifichiamo solo che non vada
    // in eccezione con questa forma di stack, dato che l'output finisce su
    // console.debug e non è osservabile dalla risposta HTTP.
    process.env.SHOW_ROUTES = 'true';

    const res = { success: jest.fn(), error: jest.fn() };

    const nestedRouterStack = [
      {
        name: 'router',
        path: '/admin',
        handle: {
          stack: [
            { route: { path: '/user', stack: [{ method: 'get' }] } },
          ],
        },
      },
    ];

    expect(() =>
      listRoutes({ app: { router: { stack: nestedRouterStack } } }, res)
    ).not.toThrow();

    expect(res.success).toHaveBeenCalledWith([]);
  });
});