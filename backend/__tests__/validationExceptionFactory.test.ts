// groupValidationErrors in isolamento: riceve gli errori di class-validator
// e produce la BadRequestException con la forma d'errore del progetto.
import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { groupValidationErrors } from '../common/validation/validation-exception.factory';

// Costruisce un ValidationError con i soli campi che la funzione legge.
function fieldError(
  property: string,
  constraints?: Record<string, string>
): ValidationError {
  return { property, constraints, children: [] } as ValidationError;
}

// Estrae l'array che il client vedrà nel campo `error`. NestJS incapsula
// l'array passato al costruttore come { message: [...], error, statusCode },
// ed è `message` che AllExceptionsFilter espone.
function clientErrorsOf(exception: BadRequestException): unknown {
  return (exception.getResponse() as { message: unknown }).message;
}

describe('groupValidationErrors', () => {
  // La forma del contratto: un elemento per campo, { id, message }, nello
  // stesso ordine in cui class-validator riporta i campi (quello di
  // dichiarazione nel DTO). È la forma prodotta per le rotte legacy da
  // validationHandlerMiddleware.
  it('produce un errore per campo, nella forma { id, message } del progetto', () => {
    const exception = groupValidationErrors([
      fieldError('email', { isNotEmpty: 'Email è richiesta' }),
      fieldError('password', { isNotEmpty: 'Password è richiesta' }),
    ]);

    expect(exception).toBeInstanceOf(BadRequestException);

    expect(clientErrorsOf(exception)).toEqual([
      { id: 'email', message: 'Email è richiesta' },
      { id: 'password', message: 'Password è richiesta' },
    ]);
  });

  // Il caso per cui esiste la priorità. Un campo mancante viola TUTTI i suoi
  // vincoli; il messaggio utile è "è richiesta". Il test prova entrambi gli
  // ordini delle chiavi, perché quell'ordine dipende da come sono disposti i
  // decoratori nel DTO: il risultato non deve cambiare.
  it('per un campo mancante mostra "è richiesto", qualunque sia l\'ordine dei vincoli', () => {
    const notEmptyFirst = fieldError('email', {
      isNotEmpty: 'Email è richiesta',
      isEmail: 'Email non valida',
    });

    const emailFirst = fieldError('email', {
      isEmail: 'Email non valida',
      isNotEmpty: 'Email è richiesta',
    });

    for (const error of [notEmptyFirst, emailFirst]) {
      expect(clientErrorsOf(groupValidationErrors([error]))).toEqual([
        { id: 'email', message: 'Email è richiesta' },
      ]);
    }
  });

  // Campo presente ma non valido: non c'è isNotEmpty fra i vincoli violati,
  // quindi vale il messaggio del vincolo che ha fallito.
  it('per un campo presente ma non valido mostra il messaggio del vincolo violato', () => {
    const exception = groupValidationErrors([
      fieldError('email', { isEmail: 'Email non valida' }),
    ]);

    expect(clientErrorsOf(exception)).toEqual([
      { id: 'email', message: 'Email non valida' },
    ]);
  });

  // Un errore senza vincoli propri (accadrebbe con un DTO annidato, dove il
  // campo padre ha solo `children`) non deve produrre un messaggio undefined.
  it('usa un messaggio generico se l\'errore non ha vincoli propri', () => {
    expect(clientErrorsOf(groupValidationErrors([fieldError('indirizzo')]))).toEqual([
      { id: 'indirizzo', message: 'Valore non valido' },
    ]);
  });
});
