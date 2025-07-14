// backend/routes/listRoutes.js
const express = require('express');
const router = express.Router();
const { listRoutes } = require('../controllers/listRoutesController');

router.get('/routes', listRoutes);

module.exports = router;