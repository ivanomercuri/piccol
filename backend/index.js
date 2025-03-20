const express = require('express');
const cors = require('cors');
const app = express();
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/authRoutes');


app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);
app.use('/api/auth', authRoutes);


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
