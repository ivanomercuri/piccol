'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn('users', 'current_token', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
      after: 'password'
    });

    await queryInterface.addColumn('customers', 'current_token', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
      after: 'password'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn('users', 'current_token');
    await queryInterface.removeColumn('customers', 'current_token');
  }
};
