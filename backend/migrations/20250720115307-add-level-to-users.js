'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'level', {
      type: Sequelize.ENUM('superadmin', 'admin'),
      allowNull: false,
      after: 'email',
      defaultValue: 'admin',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'level');
  },
};
