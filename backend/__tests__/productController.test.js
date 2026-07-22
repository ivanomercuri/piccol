// productController era completamente privo di test, nonostante getProducts
// contenga l'unica logica di autorizzazione "per riga" di tutto il progetto
// (admin vede solo i propri prodotti, superadmin li vede tutti). Mockiamo il
// modello Product per non dipendere da un DB reale.
jest.mock('../models', () => ({ Product: { findAll: jest.fn() } }));

const { Product } = require('../models');
const productController = require('../controllers/product/productController');

describe('productController.getProducts', () => {
  let res;

  beforeEach(() => {
    res = { success: jest.fn(), error: jest.fn() };

    jest.clearAllMocks();
  });

  it('should return ALL products when the user is a superadmin', async () => {
    const fakeProducts = [{ id: 1 }, { id: 2 }];

    Product.findAll.mockResolvedValue(fakeProducts);

    const req = { user: { id: 99, level: 'superadmin' } };

    await productController.getProducts(req, res);

    // Nessun filtro per createdBy: un superadmin vede il catalogo intero.
    expect(Product.findAll).toHaveBeenCalledWith();

    expect(res.success).toHaveBeenCalledWith(fakeProducts);
  });

  it('should return ONLY the products created by the user when level is admin', async () => {
    const fakeProducts = [{ id: 1, createdBy: 7 }];

    Product.findAll.mockResolvedValue(fakeProducts);

    const req = { user: { id: 7, level: 'admin' } };

    await productController.getProducts(req, res);

    expect(Product.findAll).toHaveBeenCalledWith({ where: { createdBy: 7 } });

    expect(res.success).toHaveBeenCalledWith(fakeProducts);
  });

  it('should return 403 for any level other than admin/superadmin, without querying the DB', async () => {
    // Non dovrebbe essere raggiungibile con l'enum attuale del modello User
    // (solo admin/superadmin), ma il controller lo gestisce esplicitamente:
    // verifichiamo che in quel caso non parta nemmeno una query.
    const req = { user: { id: 1, level: 'customer' } };

    await productController.getProducts(req, res);

    expect(Product.findAll).not.toHaveBeenCalled();

    expect(res.error).toHaveBeenCalledWith(403, 'Non autorizzato');
  });

  it('should return 403 (not 500) if the query throws', async () => {
    // Comportamento attuale del controller, non ovvio: qualunque eccezione
    // (anche un errore di connessione al DB) viene tradotta in un 403
    // "Errore server" invece di un 500 — documentato anche in
    // backend/docs/API.md come comportamento da tenere a mente.
    const err = new Error('Connection lost');

    Product.findAll.mockRejectedValue(err);

    const req = { user: { id: 1, level: 'superadmin' } };

    await productController.getProducts(req, res);

    expect(res.error).toHaveBeenCalledWith(403, 'Errore server', err);
  });
});

describe('productController.createProduct', () => {
  it('is currently a stub that always responds with an empty success, regardless of input', async () => {
    // Questo test non verifica una "feature": fissa deliberatamente il
    // comportamento attuale (noto, vedi CLAUDE.md "Parte nota come
    // incompleta") così che il giorno in cui createProduct verrà
    // implementato davvero, questo test fallirà — è il segnale voluto che
    // qualcosa è cambiato e va aggiornato, non un test da "correggere" alla
    // leggera.
    const res = { success: jest.fn(), error: jest.fn() };

    await productController.createProduct({ body: {}, files: [] }, res);

    expect(res.success).toHaveBeenCalledWith({});

    expect(res.error).not.toHaveBeenCalled();
  });
});