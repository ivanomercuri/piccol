'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.removeColumn('products', 'image_url');
  },

  async down (queryInterface, Sequelize) {
      // Ripristina la colonna rimossa da up(). Prima di questa correzione il
      // down era rotto in due modi, mai emersi perché nessuno lo aveva mai
      // eseguito: aggiungeva una colonna chiamata 'sku' invece di
      // 'image_url' (copia-incolla da un'altra migration), e annidava la
      // definizione dentro un oggetto { image_url: {...} } invece di
      // passarla diretta — così l'attributo risultava privo di `type` e
      // Sequelize falliva con "Cannot read properties of undefined
      // (reading 'toString')" nel generatore SQL.
      await queryInterface.addColumn('products', 'image_url', {
          type: Sequelize.STRING,
          allowNull: true,
      });
  }
};
