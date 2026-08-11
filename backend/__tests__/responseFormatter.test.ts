// responseFormatter è il middleware che monkey-patcha res.success/res.error su
// OGNI risposta dell'app (è il primo middleware montato in index.js): tutti i
// controller si fidano ciecamente della forma che produce. Prima di questo
// file non era mai stato testato direttamente, solo usato indirettamente
// tramite i mock di res.success/res.error negli altri test.
import { Request, Response, NextFunction } from 'express';

jest.mock('../config/logger', () => ({ error: jest.fn() }));

import logger from '../config/logger';
import responseFormatter from '../middlewares/responseFormatter';

describe('responseFormatter', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach(() => {
    req = { originalUrl: '/test', method: 'GET' } as unknown as Request;

    // status() deve restituire `this` per permettere il chaining
    // res.status(code).json(...) usato dal middleware.
    json = jest.fn();

    status = jest.fn(() => ({ json }));

    res = { status } as unknown as Response;

    next = jest.fn();

    jest.clearAllMocks();

    responseFormatter(req, res, next);
  });

  it('should call next() after attaching the helpers', () => {
    expect(next).toHaveBeenCalled();
  });

  it('res.success should default to status 200 and empty message', () => {
    res.success({ foo: 'bar' });

    expect(status).toHaveBeenCalledWith(200);

    expect(json).toHaveBeenCalledWith({
      success: true,
      status: 200,
      data: { foo: 'bar' },
      message: '',
    });
  });

  it('res.success should honor a custom message and status code', () => {
    res.success('ok', 'Fatto!', 201);

    expect(status).toHaveBeenCalledWith(201);

    expect(json).toHaveBeenCalledWith({
      success: true,
      status: 201,
      data: 'ok',
      message: 'Fatto!',
    });
  });

  it('res.error should default to status 500 with data: null', () => {
    res.error();

    expect(status).toHaveBeenCalledWith(500);

    expect(json).toHaveBeenCalledWith({
      success: false,
      status: 500,
      data: null,
      error: '',
    });
  });

  it('res.error should NOT log when no error instance is passed', () => {
    // Molti controller chiamano res.error(code, message) senza un terzo
    // argomento (es. errori di validazione applicativa): non deve finire
    // nulla nei log, altrimenti si riempirebbero di "errori" che non lo sono.
    res.error(400, 'Dati non validi');

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('res.error should NOT log when the third argument is not an Error instance', () => {
    // Un valore generico (es. una stringa o un oggetto) passato come `err`
    // non deve essere trattato come un errore da loggare: il middleware
    // controlla esplicitamente `err instanceof Error`.
    res.error(400, 'Dati non validi', { some: 'object' } as unknown as Error);

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('res.error should log via Winston when an Error instance is passed', () => {
    const err = new Error('Boom');

    res.error(500, 'Errore interno', err);

    expect(logger.error).toHaveBeenCalledWith('Errore:', {
      message: 'Boom',
      stack: err.stack,
      path: '/test',
      method: 'GET',
    });

    expect(json).toHaveBeenCalledWith({
      success: false,
      status: 500,
      data: null,
      error: 'Errore interno',
    });
  });
});