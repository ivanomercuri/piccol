// rejectDuplicateEmail e isUniqueConstraintViolation in isolamento.
//
// Usa un vero PrismaClientKnownRequestError con codice P2002, costruito come
// lo produce Prisma. Che l'adapter pg lo produca davvero per una email
// duplicata è verificato end-to-end in customerRoutes.test.ts e
// userRoutes.test.ts, contro PostgreSQL.
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { rejectDuplicateEmail } from '../modules/auth/duplicate-email';
import { isUniqueConstraintViolation } from '../prisma/errors';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('errore di test', {
    code,
    clientVersion: 'test',
  });
}

describe('isUniqueConstraintViolation', () => {
  // Solo P2002 è una violazione di unicità: altri errori noti di Prisma (es.
  // P2025, riga non trovata) e gli errori generici non lo sono.
  it('riconosce solo il codice P2002 di Prisma', () => {
    expect(isUniqueConstraintViolation(prismaError('P2002'))).toBe(true);

    expect(isUniqueConstraintViolation(prismaError('P2025'))).toBe(false);

    expect(isUniqueConstraintViolation(new Error('Unique constraint failed'))).toBe(false);
  });
});

describe('rejectDuplicateEmail', () => {
  // Caso normale: il risultato della scrittura passa invariato.
  it('restituisce il risultato della scrittura se va a buon fine', async () => {
    await expect(rejectDuplicateEmail(Promise.resolve({ id: 1 }))).resolves.toEqual({ id: 1 });
  });

  // DECISIONE A: la violazione del vincolo UNIQUE diventa un 409 con un
  // messaggio che il client può mostrare, invece di un 500 generico.
  it('traduce la violazione di unicità in 409 "Email già registrata"', async () => {
    await expect(rejectDuplicateEmail(Promise.reject(prismaError('P2002')))).rejects.toThrow(
      new ConflictException('Email già registrata')
    );
  });

  // Qualunque altro errore non è affar suo: deve risalire intatto fino al
  // filter, altrimenti un guasto del database verrebbe spacciato per un
  // conflitto causato dal client.
  it('lascia risalire intatto qualunque altro errore', async () => {
    const outage = new Error('connessione rifiutata');

    const notFound = prismaError('P2025');

    await expect(rejectDuplicateEmail(Promise.reject(outage))).rejects.toBe(outage);

    await expect(rejectDuplicateEmail(Promise.reject(notFound))).rejects.toBe(notFound);
  });
});
