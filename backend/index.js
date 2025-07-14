require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const responseFormatter = require('./middlewares/responseFormatter');

const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');
const listRoutes = require('./routes/listRoutes');
const noPathMiddleware = require('./middlewares/noPathMiddleware');
const errorMiddleware = require('./middlewares/errorMiddleware');

app.use(responseFormatter);
app.use(cors());
app.use(express.json());

app.use('/', customerRoutes);
app.use('/admin', adminRoutes);
app.use(listRoutes);

app.use(noPathMiddleware);
app.use(errorMiddleware);

module.exports = app;