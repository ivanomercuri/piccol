// noPathMiddleware è il catch-all per le route non trovate (404), montato
// dopo tutti i router in index.js. È volutamente molto semplice, ma prima di
// questo file non aveva nessun test che ne fissasse il comportamento atteso.
const noPathMiddleware = require('../middlewares/noPathMiddleware');

describe('noPathMiddleware', () => {
  it('should always respond with a 404 and a generic "not found" message', () => {
    const res = { error: jest.fn() };

    noPathMiddleware({}, res);

    expect(res.error).toHaveBeenCalledWith(404, 'Non trovato');
  });
});