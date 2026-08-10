import mysql from 'mysql2/promise';
import { Request, Response } from 'express';

// Nota: questo controller non risulta collegato a nessuna route (verificato
// con una ricerca su tutto il backend) — resta così anche in questa fase,
// la conversione a TypeScript non cambia lo stato "non montato" del file,
// solo la sua tipizzazione.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

export const getExample = async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [rows] = await pool.query('SELECT NOW() as currentTime');

    res.json({
      test: 'ina',
    });
  } catch (error) {
    // `error` è tipizzato `unknown` sotto strict: true (non più `any` come
    // implicitamente in JS): il cast riflette che qui non c'è mai stato un
    // controllo sulla forma reale dell'errore, invariato rispetto al file
    // .js originale.
    res.status(500).json({ error: (error as Error).message });
  }
};