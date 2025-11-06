'use strict';
const bcrypt = require('bcryptjs');
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    return queryInterface.bulkInsert('users', [
      {
        name: 'Master',
        email: 'master@example.com',
        level: 'superadmin',
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
  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', {
      email: ['mario@example.com', 'luigi@example.com']
    }, {});
  }
};
