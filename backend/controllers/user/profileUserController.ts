import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../prisma/client';
import { normalizeEmail } from '../../services/emailNormalizer';

export const getProfileUser = (req: Request, res: Response) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }

  const { id, name, email, level } = user;
  const returnUser = { id, name, email, level };

  return res.success(returnUser);
};

export const updateProfileUser = async (req: Request, res: Response) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }

  const { name, email } = req.body;

  try {
    // Con Sequelize si assegnavano le proprietà sull'istanza e si chiamava
    // user.save(). Le righe lette da Prisma sono oggetti semplici, senza
    // metodi: l'aggiornamento passa da un update esplicito. L'oggetto `data`
    // viene costruito con i soli campi presenti nel body, per conservare il
    // comportamento precedente (i campi non inviati restano invariati, non
    // vengono azzerati).
    const data: { name?: string; email?: string } = {};

    if (name) data.name = name;

    // Terzo punto in cui un'email viene scritta, oltre a registerService:
    // qui l'aggiornamento avviene fuori dai service condivisi, quindi la
    // normalizzazione va applicata esplicitamente anche qui, altrimenti un
    // utente potrebbe salvare "Mario@x.com" e poi non riuscire più a fare
    // login (authService cerca sempre la forma minuscola).
    if (email) data.email = normalizeEmail(email);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    return res.success({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
    });
  } catch {
    return res.error(500, "Errore durante l'aggiornamento del profilo");
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }

  const { oldPassword, newPassword } = req.body;

  try {
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.error(400, 'La vecchia password non corrisponde');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res.success({}, 'Password aggiornata con successo');
  } catch {
    return res.error(500, 'Errore durante il cambio della password');
  }
};

export const logout = async (req: Request, res: Response) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }

  try {
    // Azzerare current_token è ciò che invalida il JWT ancora in mano al
    // client: authUserMiddleware confronta il token della richiesta con
    // questo campo (vedi il pattern di invalidazione in CLAUDE.md).
    await prisma.user.update({
      where: { id: user.id },
      data: { current_token: null },
    });

    return res.success({}, 'Logout effettuato con successo');
  } catch {
    return res.error(500, 'Errore durante il logout');
  }
};
