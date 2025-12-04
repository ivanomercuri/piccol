'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'sku', {
      type: Sequelize.STRING(100),
      unique: true,
      after: 'available',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'sku');
  },
};
