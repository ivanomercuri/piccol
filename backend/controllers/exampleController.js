const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

exports.getExample = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW() as currentTime');

    res.json({
      test: 'ina',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
