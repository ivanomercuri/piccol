'use strict';

/**
 * Migration for creating the 'products' table.
 * Includes columns for id, name, description, price, quantity, image_url, available, createdAt, updatedAt.
 */
module.exports = {
  // Run when migrating up (creating the table)
  async up(queryInterface, Sequelize) {
    // Create 'products' table with specified columns
    await queryInterface.createTable('products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      image_url: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      available: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      }
    });
  },

  // Run when migrating down (dropping the table)
  async down(queryInterface, Sequelize) {
    // Drop 'products' table
    await queryInterface.dropTable('products');
  }
};
