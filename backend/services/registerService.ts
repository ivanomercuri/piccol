import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { signToken } from './tokenService';
import { normalizeEmail } from './emailNormalizer';

// Dati accettati dalla registrazione di un utente interno/admin. Ogni entità
// dichiara esattamente i propri campi: un campo di troppo o mancante è un
// errore di compilazione, non un problema scoperto dal database a runtime.
// (Quelli del Customer sono in modules/customer/dto/register-customer.dto.ts
// dalla fase F2.)
interface UserRegistrationData {
  name: string;
  email: string;
  password: string;
}

/**
 * Parte condivisa della registrazione: firma del token per l'entità appena
 * creata e sua persistenza su current_token. Come in authService, la
 * condivisione avviene sull'entità già creata invece che su un modello
 * generico — l'unica cosa che cambia fra User e Customer è la create.
 *
 * ESPORTATA DALLA FASE F2, per lo stesso motivo di completeAuthentication in
 * authService.ts: la registrazione dei Customer vive ora in
 * modules/customer/customer-auth.service.ts, e deve usare questa stessa
 * funzione invece di duplicarla. Diventerà un provider iniettabile in F3.
 */
export async function issueTokenFor(
  entity: { id: number; email: string },
  persistToken: (token: string) => Promise<unknown>
): Promise<string> {
  // Il payload del token è sempre { id, email }: prima era configurabile
  // tramite il parametro `tokenPayloadFields`, ma entrambi i chiamanti
  // passavano gli stessi due campi — una flessibilità mai usata, che
  // costringeva a costruire il payload dinamicamente leggendo proprietà per
  // nome. Resa esplicita.
  const token = signToken({ id: entity.id, email: entity.email });

  await persistToken(token);

  return token;
}

/** Registra un utente interno/admin e restituisce il suo JWT. */
export async function registerUser(data: UserRegistrationData): Promise<string> {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  // L'email è salvata in minuscolo: su PostgreSQL il vincolo UNIQUE è
  // case-sensitive, quindi senza normalizzazione "Mario@x.com" e
  // "mario@x.com" sarebbero due account distinti per la stessa identità
  // (vedi services/emailNormalizer.ts).
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: normalizeEmail(data.email),
      password: hashedPassword,
    },
  });

  return issueTokenFor(user, (token) =>
    prisma.user.update({
      where: { id: user.id },
      data: { current_token: token },
    })
  );
}
