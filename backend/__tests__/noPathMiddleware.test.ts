// noPathMiddleware è il catch-all per le route non trovate (404), montato
// dopo tutti i router in index.js. È volutamente molto semplice, ma prima di
// questo file non aveva nessun test che ne fissasse il comportamento atteso.
import { Request, Response } from 'express';
import noPathMiddleware from '../middlewares/noPathMiddleware';

describe('noPathMiddleware', () => {
  it('should always respond with a 404 and a generic "not found" message', () => {
    const res = { error: jest.fn() } as unknown as Response;

    noPathMiddleware({} as unknown as Request, res);

    expect(res.error).toHaveBeenCalledWith(404, 'Non trovato');
  });
});