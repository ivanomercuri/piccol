import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Un errore di validazione come lo vede il client: il campo e UN messaggio.
 * È la stessa forma che produceva middlewares/validationHandlerMiddleware.ts
 * prima della migrazione a NestJS, conservata perché fa parte del contratto
 * API (decisione D2, docs/MIGRAZIONE-NESTJS.md).
 */
export interface FieldValidationError {
  id: string;
  message: string;
}

/**
 * Nome del vincolo di @IsNotEmpty() in class-validator. Quando un campo
 * manca, fallisce anche ogni altro vincolo sullo stesso campo (un valore
 * assente non è né una stringa né un'email valida): fra tutti, "è richiesto"
 * è l'unico messaggio utile, perché dice al client che cosa fare.
 */
const MISSING_VALUE_CONSTRAINT = 'isNotEmpty';

/**
 * Usato se un errore non porta nessun messaggio proprio. Con i DTO piatti di
 * oggi non accade; accadrebbe con un DTO annidato, dove l'errore del campo
 * padre ha solo `children` e nessun `constraints`.
 */
const FALLBACK_MESSAGE = 'Valore non valido';

/**
 * exceptionFactory della ValidationPipe globale (registrata in AppModule).
 *
 * Senza questa funzione, NestJS risponderebbe a un DTO non valido con un
 * array piatto di frasi in inglese generate da class-validator, mescolate fra
 * campi diversi ("email must be an email", "password should not be empty").
 * Qui invece si restituisce UN messaggio per campo, nell'ordine in cui i campi
 * sono dichiarati nel DTO.
 *
 * Rispetto al vecchio validationHandlerMiddleware mancano due cose, di
 * proposito:
 * - il flag `isFatal` e la sua gestione prioritaria: esisteva solo perché nel
 *   modello a middleware l'errore di multer doveva viaggiare insieme agli
 *   altri; in NestJS un'eccezione interrompe la richiesta da sola (§4.4);
 * - il raggruppamento delle immagini per nome di file: è specifico
 *   dell'upload dei prodotti, e vive in modules/product/upload/new-product-form.ts.
 *
 * Restituisce l'eccezione invece di lanciarla perché è il contratto di
 * exceptionFactory: è la ValidationPipe a lanciarla. Arriva poi ad
 * AllExceptionsFilter come qualunque altra BadRequestException: NestJS
 * incapsula l'array come `{ message: [...], error, statusCode }`, e il filter
 * espone `message` nel campo `error` della risposta.
 */
export function groupValidationErrors(
  errors: ValidationError[]
): BadRequestException {
  return new BadRequestException(toFieldErrors(errors));
}

/**
 * Converte gli errori di class-validator nella forma del progetto, senza
 * lanciare. Esportata dalla fase F4 per chi deve UNIRE questi errori ad altri
 * prima di rispondere: la validazione di un nuovo prodotto li combina con
 * quelli dell'immagine (modules/product/upload/new-product-form.ts).
 */
export function toFieldErrors(errors: ValidationError[]): FieldValidationError[] {
  return errors.map((error) => ({ id: error.property, message: messageOf(error) }));
}

/**
 * Sceglie il messaggio da mostrare per un campo che ha violato più vincoli.
 *
 * PERCHÉ UNA PRIORITÀ ESPLICITA E NON "IL PRIMO"
 * `constraints` è un oggetto { nomeVincolo: messaggio }, e l'ordine delle sue
 * chiavi dipende dall'ordine in cui i decoratori vengono APPLICATI — che in
 * TypeScript è dal basso verso l'alto, l'opposto di come si leggono nel
 * sorgente. Affidarsi a quell'ordine vorrebbe dire che invertire due righe
 * in un DTO cambia il messaggio mostrato al client, senza che nulla lo
 * segnali. La priorità scritta qui rende il risultato indipendente da come
 * sono disposti i decoratori.
 */
function messageOf(error: ValidationError): string {
  const constraints = error.constraints ?? {};

  return (
    constraints[MISSING_VALUE_CONSTRAINT] ??
    Object.values(constraints)[0] ??
    FALLBACK_MESSAGE
  );
}
