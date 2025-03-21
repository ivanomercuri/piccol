require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const responseFormatter = require('./middlewares/responseFormatter');

const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const noPathMiddleware = require('./middlewares/noPathMiddleware');

app.use(cors());
app.use(express.json());
app.use(responseFormatter);

app.use('/', customerRoutes);
app.use('/user', userRoutes);

app.use(noPathMiddleware);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
