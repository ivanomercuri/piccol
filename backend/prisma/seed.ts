import bcrypt from 'bcryptjs';
import { prisma } from './client';

/**
 * Popola il database di sviluppo con gli utenti di prova. Sostituisce il
 * seeder Sequelize (seeders/20250319235619-users.js), che usava
 * queryInterface.bulkInsert.
 *
 * Differenza di comportamento rispetto al seeder precedente: qui si usa
 * upsert invece di un insert secco, quindi rieseguire il seed è
 * un'operazione sicura e ripetibile — prima una seconda esecuzione falliva
 * con una violazione del vincolo UNIQUE su email (è esattamente ciò che era
 * successo provando a rilanciare i seeder su un database già popolato).
 */
async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    { name: 'Master', email: 'master@example.com', level: 'superadmin' },
    { name: 'Mario Rossi', email: 'mario@example.com', level: 'admin' },
    { name: 'Luigi Verdi', email: 'luigi@example.com', level: 'admin' },
  ] as const;

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      // Non tocca le righe già presenti: se qualcuno ha cambiato la password
      // di un utente di prova, un nuovo seed non gliela riazzera.
      update: {},
      create: {
        name: user.name,
        email: user.email,
        level: user.level,
        password: hashedPassword,
      },
    });
  }

  console.log(`Seed completato: ${users.length} utenti garantiti.`);
}

main()
  .catch((error) => {
    console.error('Seed fallito:', error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
