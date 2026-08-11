import dotenv from 'dotenv';

dotenv.config();

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