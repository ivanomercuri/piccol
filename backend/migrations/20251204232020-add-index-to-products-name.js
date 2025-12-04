'use strict';

module.exports = {
    async up(queryInterface) {
        // Il nome dell'indice è opzionale, Sequelize ne genererà uno se non specificato
        await queryInterface.addIndex('products', ['name']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('products', ['name']);
    },
};