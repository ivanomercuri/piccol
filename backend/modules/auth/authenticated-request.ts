import type { User } from '@prisma/client';

/**
 * La parte di una richiesta HTTP che l'autenticazione del progetto usa: gli
 * header in entrata e l'utente che AuthUserGuard vi scrive.
 *
 * PERCHÉ UN TIPO PROPRIO, E NON QUELLO DELLA PIATTAFORMA
 * Descrive solo ciò che serve (structural typing: in TypeScript un oggetto è
 * compatibile con un tipo se ne ha i membri, senza doverlo dichiarare — non
 * esiste un equivalente in PHP, dove servirebbe implementare un'interfaccia).
 * Guard e decoratore restano quindi indipendenti dalla piattaforma HTTP: dalla
 * fase F7 l'app gira su Fastify, e questi file non hanno dovuto cambiare tipo.
 *
 * Fino a F6 il tipo dell'utente arrivava invece da un'estensione globale
 * (`types/express.d.ts` estendeva `Express.User`), necessaria perché i tipi di
 * passport dichiaravano loro `request.user`. Con il guard scritto a mano
 * quell'estensione globale non serve più: chi scrive `user` è codice del
 * progetto, quindi il tipo può essere locale ed esplicito.
 */
export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user?: User;
}
