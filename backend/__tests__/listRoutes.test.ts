// GET /routes non è montata sotto nessun prefisso (app.use(listRoutes) in
// index.ts): raggiungibile direttamente a /routes. Il comportamento gated da
// SHOW_ROUTES era già coperto da un test unitario sul controller
// (listRoutesController.test.ts); qui verifichiamo lo stesso comportamento
// attraversando davvero l'app Express, per essere certi che il mounting in
// index.ts sia quello giusto.
import request from 'supertest';
import app from '../index';
import models from '../models';

const { sequelize } = models;

describe('GET /routes', () => {
  const originalShowRoutes = process.env.SHOW_ROUTES;

  afterEach(() => {
    process.env.SHOW_ROUTES = originalShowRoutes;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should return 403 when SHOW_ROUTES is not "true"', async () => {
    process.env.SHOW_ROUTES = 'false';

    const res = await request(app).get('/routes');

    expect(res.status).toBe(403);

    expect(res.body.error).toBe('Accesso negato');
  });

  it('should return 200 with an empty data array when SHOW_ROUTES is "true"', async () => {
    // Il corpo della risposta non contiene mai l'elenco delle route (finisce
    // solo su console.debug lato server): lo documentiamo anche qui, non
    // solo nel test del controller, perché è facile aspettarsi il contrario
    // testando l'endpoint dall'esterno.
    process.env.SHOW_ROUTES = 'true';

    const res = await request(app).get('/routes');

    expect(res.status).toBe(200);

    expect(res.body.data).toEqual([]);
  });
});