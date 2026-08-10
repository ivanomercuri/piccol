import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';

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
    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();
    const updatedUser = { id: user.id, name: user.name, email: user.email };

    return res.success(updatedUser);
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

    user.password = hashedPassword;

    await user.save();

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
    user.current_token = null;

    await user.save();

    return res.success({}, 'Logout effettuato con successo');
  } catch {
    return res.error(500, 'Errore durante il logout');
  }
};