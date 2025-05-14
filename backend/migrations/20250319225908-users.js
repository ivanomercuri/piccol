'use strict';

/**
 * Migration for creating the 'users' table.
 * Includes columns for id, name, email, password, createdAt, updatedAt.
 */
module.exports = {
  // Run when migrating up (creating the table)
  async up(queryInterface, Sequelize) {
    // Create 'users' table with specified columns
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  // Run when migrating down (dropping the table)
  async down(queryInterface, Sequelize) {
    // Drop 'users' table
    await queryInterface.dropTable('users');
  }
};
