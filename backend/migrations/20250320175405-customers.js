'use strict';

/**
 * Migration for creating the 'customers' table.
 * Includes columns for id, email, password, firstName, lastName, address, createdAt, updatedAt.
 */
module.exports = {
  // Run when migrating up (creating the table)
  async up(queryInterface, Sequelize) {
    // Create 'customers' table with specified columns
    await queryInterface.createTable('customers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  // Run when migrating down (dropping the table)
  async down(queryInterface, Sequelize) {
    // Drop 'customers' table
    await queryInterface.dropTable('customers');
  }
};
