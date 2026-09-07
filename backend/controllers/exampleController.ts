import { Pool } from 'pg';
import { Request, Response } from 'express';

// ATTENZIONE: questo controller NON è collegato a nessuna route (verificato
// con una ricerca su tutto il backend) ed è tenuto solo come esempio
// didattico di connessione diretta al database, fuori da Sequelize.
//
// Non va preso a modello per codice nuovo: AGENTS.md prevede che l'accesso ai
// dati passi dai modelli Sequelize (`/backend/models`) e che la logica stia
// nei services, non che un controller apra una connessione per conto proprio.
// Se un giorno servisse davvero una query fuori dall'ORM, la sede corretta è
// un service, non qui.
//
// Ricostruito con `pg` durante la migrazione da MySQL a PostgreSQL: la
// versione precedente importava `mysql2/promise`, driver rimosso dal
// progetto, e rompeva quindi `npm run type-check`.
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  // Non `DB_PASSWORD`, come nella versione MySQL di questo file: quella
  // variabile non è mai esistita in `.env`, quindi la connessione sarebbe
  // partita senza password. La variabile reale del progetto è
  // DB_ROOT_PASSWORD (vedi .env.example e config/config.js).
  password: process.env.DB_ROOT_PASSWORD,
  database: process.env.DB_NAME,
});

export const getExample = async (req: Request, res: Response) => {
  try {
    // NOW() esiste identica in MySQL e PostgreSQL, quindi la query non è
    // cambiata nella migrazione. `rows` viene ora restituito davvero: la
    // versione precedente lo scartava e rispondeva con un oggetto fisso
    // ({ test: 'ina' }), rendendo l'esempio incapace di dimostrare proprio
    // ciò che voleva mostrare, cioè che la connessione funziona.
    const { rows } = await pool.query('SELECT NOW() as "currentTime"');

    // res.success/res.error invece di res.json grezzo: è la convenzione di
    // risposta del progetto (middlewares/responseFormatter.ts), che la
    // versione precedente non seguiva.
    return res.success(rows[0]);
  } catch (error) {
    return res.error(500, 'Errore di connessione al database', error as Error);
  }
};
