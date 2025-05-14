'use strict';

// Import required modules
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');

// Get the current file name and environment
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
// Load configuration for the current environment
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

// Enable SQL query logging
config.logging = console.log;

// Initialize Sequelize instance
let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Dynamically import all model files in this directory (except index.js and test files)
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    // Import each model and add it to the db object
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Run associate method for models that define associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add Sequelize instance and library to the db object
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Export the db object containing all models and Sequelize instance
module.exports = db;

