const userRoutes = require("./userRoutes");
const express = require("express");
const adminRoutes = express.Router();
adminRoutes.use('/user', userRoutes);
module.exports = adminRoutes;