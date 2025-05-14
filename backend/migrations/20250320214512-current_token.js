'use strict';

/**
 * Migration for adding 'current_token' column to 'users' and 'customers' tables.
 */
module.exports = {
  // Run when migrating up (adding columns)
  async up(queryInterface, Sequelize) {
    // Add 'current_token' column to 'users' table
    await queryInterface.addColumn('users', 'current_token', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
      after: 'password'
    });

    // Add 'current_token' column to 'customers' table
    await queryInterface.addColumn('customers', 'current_token', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
      after: 'password'
    });
  },

  // Run when migrating down (removing columns)
  async down(queryInterface, Sequelize) {
    // Remove 'current_token' column from 'users' table
    await queryInterface.removeColumn('users', 'current_token');
    // Remove 'current_token' column from 'customers' table
    await queryInterface.removeColumn('customers', 'current_token');
  }
};
