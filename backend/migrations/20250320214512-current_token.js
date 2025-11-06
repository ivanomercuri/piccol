'use strict';
module.exports = {
  
  async up(queryInterface, Sequelize) {
    
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
    
    await queryInterface.removeColumn('users', 'current_token');
    
    await queryInterface.removeColumn('customers', 'current_token');
  }
};
