// jsonSyntaxErrorMiddleware in isolamento. Eredita dal vecchio
// errorMiddleware.test.ts i due casi sul SyntaxError e il presidio
// sull'arità, che qui resta necessario per lo stesso motivo: anche questo è
// un gestore d'errore Express, riconosciuto solo se dichiara 4 parametri.
import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { jsonSyntaxErrorMiddleware } from '../middlewares/jsonSyntaxErrorMiddleware';

describe('jsonSyntaxErrorMiddleware', () => {
  const req = {} as Request;
  const res = {} as Response;
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  // Crea l'errore con la stessa forma che produce body-parser su un body
  // malformato: SyntaxError + status 400 + la proprietà `body`.
  function bodyParserError(message: string): SyntaxError {
    return Object.assign(new SyntaxError(message), {
      status: 400,
      body: '{"email": "rotto"',
    });
  }

  // Il caso per cui il middleware esiste: l'errore del parser diventa una
  // BadRequestException che porta già il messaggio italiano del contratto
  // API. Deve farlo ORA, perché a valle NestJS convertirebbe il SyntaxError
  // in un 400 generico perdendo l'informazione.
  it('traduce l\'errore di body-parser in una BadRequestException "errore json: ..."', () => {
    jsonSyntaxErrorMiddleware(
      bodyParserError('Unexpected end of JSON input'),
      req,
      res,
      next as NextFunction
    );

    const forwarded = next.mock.calls[0][0];

    expect(forwarded).toBeInstanceOf(BadRequestException);

    expect(forwarded.message).toBe('errore json: Unexpected end of JSON input');
  });

  // Un SyntaxError senza `body` non viene dal parser (può essere un bug in
  // un JSON.parse del codice applicativo): non va spacciato per un errore
  // del client, quindi prosegue intatto.
  it('lascia passare intatto un SyntaxError che non viene da body-parser', () => {
    const unrelated = Object.assign(new SyntaxError('altro'), { status: 400 });

    jsonSyntaxErrorMiddleware(unrelated, req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(unrelated);
  });

  // Qualunque altro errore non è affar suo.
  it('lascia passare intatto qualunque altro errore', () => {
    const other = new Error('boom');

    jsonSyntaxErrorMiddleware(other, req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(other);
  });

  // Presidio del contratto con Express: con 3 parametri il middleware
  // verrebbe registrato come middleware ordinario e saltato in silenzio su
  // ogni errore — il bug che ha vissuto per mesi in errorMiddleware.ts.
  it('dichiara 4 parametri, altrimenti Express non lo riconosce come gestore d\'errore', () => {
    expect(jsonSyntaxErrorMiddleware.length).toBe(4);
  });
});
