'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.removeColumn('products', 'image_url');
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.addColumn('products', 'sku', {
          image_url: {
              type: Sequelize.STRING,
              allowNull: true,
              after: 'quantity'
          }
      });
  }
};
