import { ConflictException } from '@nestjs/common';
import { isUniqueConstraintViolation } from '../../prisma/errors';

/**
 * Esegue una scrittura che imposta un'email e, se quell'email appartiene già
 * a un altro account, la rifiuta con 409 "Email già registrata".
 *
 *   const user = await rejectDuplicateEmail(this.prisma.user.create({ ... }));
 *
 * DECISIONE A (fase F3, docs/MIGRAZIONE-NESTJS.md): prima una email duplicata
 * produceva un 500 generico, cioè "qualcosa è andato storto" per un caso del
 * tutto previsto, che finiva anche nei log come errore imprevisto.
 *
 * PERCHÉ INTERCETTARE L'ERRORE E NON CONTROLLARE PRIMA
 * Sembrerebbe più semplice cercare l'email con findUnique e rifiutare se
 * esiste. Ma fra la ricerca e la scrittura passa del tempo: due registrazioni
 * con la stessa email che arrivano insieme troverebbero entrambe "libero", e
 * la seconda esploderebbe comunque sul vincolo del database. Il vincolo UNIQUE
 * è l'unico arbitro affidabile (categoria Concurrency del protocollo di
 * AGENTS.md): qui ci si limita a tradurre la sua risposta.
 *
 * Usata in tre punti: registrazione di User e Customer, aggiornamento del
 * profilo degli User. Qualunque altro errore risale intatto.
 */
export async function rejectDuplicateEmail<T>(write: PromiseLike<T>): Promise<T> {
  try {
    // `await` qui dentro, e non un semplice `return write`: le query di
    // Prisma sono "pigre" e partono solo quando qualcuno le attende. Senza
    // await dentro il try, l'errore arriverebbe dopo l'uscita dal blocco e
    // non verrebbe intercettato.
    return await write;
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictException('Email già registrata');
    }

    throw error;
  }
}
