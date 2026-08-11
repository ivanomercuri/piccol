import express from 'express';
import userRoutes from './userRoutes';

const adminRoutes = express.Router();

adminRoutes.use('/user', userRoutes);

export = adminRoutes;