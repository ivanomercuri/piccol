import { SetMetadata } from '@nestjs/common';

/** Chiave con cui il messaggio viene salvato nei metadati del metodo. */
export const RESPONSE_MESSAGE_KEY = 'responseMessage';

/**
 * Imposta il campo `message` della risposta di successo di una rotta:
 *
 *   @Post('logout')
 *   @ResponseMessage('Logout effettuato con successo')
 *   logout() { ... }
 *
 * Nei controller legacy il messaggio era il secondo argomento di
 * res.success(data, message). Con NestJS il controller restituisce solo il
 * dato, e l'involucro lo costruisce ResponseEnvelopeInterceptor: il messaggio
 * deve quindi arrivargli per un'altra strada.
 *
 * COME FUNZIONA
 * SetMetadata attacca un valore al METODO del controller (non alla
 * richiesta): è un'informazione dichiarata una volta, nel sorgente.
 * L'interceptor la legge con il Reflector di NestJS a ogni chiamata di quel
 * metodo.
 *
 * PER CHI VIENE DA PHP
 * È lo stesso meccanismo degli attributi PHP 8 letti con la Reflection, come
 * fa Symfony con #[Route] o #[IsGranted]: un'annotazione sul metodo che un
 * altro componente legge per decidere come comportarsi.
 *
 * Progettato in F3 e non prima di proposito: in F1 non esisteva ancora
 * nessuna rotta NestJS che avesse un messaggio di successo.
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);
