import { Prisma } from '@prisma/client';

/**
 * Codice con cui Prisma segnala la violazione di un vincolo di unicità.
 * Documentazione: https://www.prisma.io/docs/orm/reference/error-reference#p2002
 */
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/**
 * Dice se un errore è la violazione di un vincolo UNIQUE del database.
 *
 * Si guarda SOLO il codice, non quale vincolo sia stato violato, e il motivo
 * è verificato: con il driver adapter `pg` di Prisma 7 l'errore NON ha il
 * campo `meta.target` descritto dalla documentazione classica di Prisma. Il
 * nome del vincolo si trova in
 * `meta.driverAdapterError.cause.constraint.index`, una struttura interna
 * dell'adapter. Un controllo su `meta.target` non avrebbe mai trovato nulla,
 * senza dare errori; uno sulla struttura interna si romperebbe al primo
 * aggiornamento dell'adapter.
 *
 * Chi usa questa funzione deve quindi sapere quale vincolo può violare la
 * propria scrittura. Oggi i chiamanti scrivono sulle tabelle users e
 * customers, dove l'unico vincolo UNIQUE oltre alla chiave primaria è
 * l'email.
 *
 * Sta nel data layer perché riguarda solo il linguaggio di Prisma, e potrà
 * servire ad altri vincoli (ad esempio lo `sku` dei prodotti).
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}
