// GET /routes non è montata sotto nessun prefisso (app.use(listRoutes) in
// mountLegacyRouters, app.setup.ts): raggiungibile direttamente a /routes. Il
// comportamento gated da SHOW_ROUTES era già coperto da un test unitario sul
// controller (listRoutesController.test.ts); qui verifichiamo lo stesso
// comportamento attraversando davvero l'app, per essere certi che il
// mounting sia quello giusto. Destinato a sparire in F5 insieme alla rotta
// (decisione D8).
import request from 'supertest';
import type { Server } from 'http';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/createTestApp';

describe('GET /routes', () => {
  // Bootstrap dell'app NestJS (fase F1): unica parte cambiata di questo file.
  // `app` resta il nome usato da tutte le chiamate request(app) qui sotto, che
  // quindi non cambiano; ora è il server HTTP dell'app NestJS invece
  // dell'app Express esportata dal vecchio index.ts.
  let nestApp: INestApplication;
  let app: Server;

  beforeAll(async () => {
    nestApp = await createTestApp();

    app = nestApp.getHttpServer();
  });

  const originalShowRoutes = process.env.SHOW_ROUTES;

  afterEach(() => {
    process.env.SHOW_ROUTES = originalShowRoutes;
  });

  afterAll(async () => {
    // Chiude l'app NestJS: PrismaModule.onApplicationShutdown esegue il
    // $disconnect che prima si chiamava qui a mano.
    await nestApp.close();
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