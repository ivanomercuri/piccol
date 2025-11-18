'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'createdBy', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      after: 'available',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'createdBy');
  },
};
