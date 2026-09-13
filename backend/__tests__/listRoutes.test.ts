// GET /routes non è montata sotto nessun prefisso (app.use(listRoutes) in
// mountLegacyRouters, app.setup.ts): raggiungibile direttamente a /routes. Il
// comportamento gated da SHOW_ROUTES era già coperto da un test unitario sul
// controller (listRoutesController.test.ts); qui verifichiamo lo stesso
// comportamento attraversando davvero l'app, per essere certi che il
// mounting sia quello giusto. Destinato a sparire in F5 insieme alla rotta
// (decisione D8).
import request from 'supertest';
import { useTestApp } from './helpers/useTestApp';

// Avvio e chiusura dell'app NestJS, gestiti dall'helper. Chiamato qui, alla
// radice del file e fuori dal describe, perché la chiusura (che disconnette
// Prisma) avvenga sempre DOPO gli afterAll di pulizia del describe: vedi il
// commento in helpers/useTestApp.ts.
const testApp = useTestApp();

describe('GET /routes', () => {
  const originalShowRoutes = process.env.SHOW_ROUTES;

  afterEach(() => {
    process.env.SHOW_ROUTES = originalShowRoutes;
  });

  it('should return 403 when SHOW_ROUTES is not "true"', async () => {
    process.env.SHOW_ROUTES = 'false';

    const res = await request(testApp.http).get('/routes');

    expect(res.status).toBe(403);

    expect(res.body.error).toBe('Accesso negato');
  });

  it('should return 200 with an empty data array when SHOW_ROUTES is "true"', async () => {
    // Il corpo della risposta non contiene mai l'elenco delle route (finisce
    // solo su console.debug lato server): lo documentiamo anche qui, non
    // solo nel test del controller, perché è facile aspettarsi il contrario
    // testando l'endpoint dall'esterno.
    process.env.SHOW_ROUTES = 'true';

    const res = await request(testApp.http).get('/routes');

    expect(res.status).toBe(200);

    expect(res.body.data).toEqual([]);
  });
});