'use strict';

// Import bcrypt for password hashing
const bcrypt = require('bcryptjs');

/** 
 * Seeder for inserting initial users into the database.
 */
module.exports = {
  // Seed the database with initial users
  async up(queryInterface, Sequelize) {
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Insert user records into the 'users' table
    return queryInterface.bulkInsert('users', [
      {
        name: 'Master',
        email: 'master@example.com',
        level: 'superadmin', // Assuming level is a column in the users table
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mario Rossi',
        email: 'mario@example.com',
        level: 'admin',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Luigi Verdi',
        email: 'luigi@example.com',
        level: 'admin',
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  // Remove the seeded users from the database
  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', {
      email: ['mario@example.com', 'luigi@example.com']
    }, {});
  }
};
