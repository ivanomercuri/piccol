import dotenv from 'dotenv';
import path from 'path';

// .env vive alla radice del repo (accanto a docker-compose.yml), non più
// in backend/: è lo stesso identico file che Docker Compose legge per
// interpolare docker-compose.yml (es. PORT nella mappatura delle porte).
// Un percorso esplicito basato su __dirname, invece del default di dotenv
// (che cerca .env nella cwd), funziona a prescindere da dove viene lanciato
// il processo. Dentro Docker questo per lo più non trova nulla da caricare
// (la cartella non è montata) e non è un problema: le stesse variabili
// arrivano già iniettate nel processo da `env_file` in docker-compose.yml,
// e dotenv non sovrascrive mai variabili già presenti in process.env.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import responseFormatter from './middlewares/responseFormatter';
import adminRoutes from './routes/adminRoutes';
import customerRoutes from './routes/customerRoutes';
import productRoutes from './routes/productRoutes';
import listRoutes from './routes/listRoutes';
import noPathMiddleware from './middlewares/noPathMiddleware';
import errorMiddleware from './middlewares/errorMiddleware';

const app = express();

app.use(responseFormatter);

app.use(cors());

app.use(express.json());

app.use('/', customerRoutes);

app.use('/admin', adminRoutes);

app.use('/products', productRoutes);

app.use(listRoutes);

app.use(noPathMiddleware);

app.use(errorMiddleware);

export = app;