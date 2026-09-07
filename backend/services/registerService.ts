import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { signToken } from './tokenService';
import { normalizeEmail } from './emailNormalizer';

// Dati accettati dalla registrazione di ciascuna entità. Prima erano un
// unico tipo generico con indice `[key: string]: unknown`, perché la
// funzione condivisa non poteva sapere quali campi avesse il modello che
// riceveva: ora che le due funzioni sono distinte, ognuna dichiara
// esattamente i propri campi e un campo di troppo o mancante è un errore di
// compilazione, non un problema scoperto dal database a runtime.
interface UserRegistrationData {
  name: string;
  email: string;
  password: string;
}

interface CustomerRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  address?: string | null;
}

/**
 * Parte condivisa della registrazione: firma del token per l'entità appena
 * creata e sua persistenza su current_token. Come in authService, la
 * condivisione avviene sull'entità già creata invece che su un modello
 * generico — l'unica cosa che cambia fra User e Customer è la create.
 */
async function issueTokenFor(
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
async function registerUser(data: UserRegistrationData): Promise<string> {
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

/** Registra un cliente dello storefront e restituisce il suo JWT. */
async function registerCustomer(
  data: CustomerRegistrationData
): Promise<string> {
  const hashedPassword = await bcrypt.hash(data.password, 10);

  const customer = await prisma.customer.create({
    data: {
      email: normalizeEmail(data.email),
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      address: data.address ?? null,
    },
  });

  return issueTokenFor(customer, (token) =>
    prisma.customer.update({
      where: { id: customer.id },
      data: { current_token: token },
    })
  );
}

export { registerUser, registerCustomer };
