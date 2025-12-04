'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('product_categories', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            product_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'products', // Si riferisce alla tabella 'products'
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE', // Se un prodotto viene cancellato, le sue associazioni vengono rimosse
            },
            category_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'categories', // Si riferisce alla tabella 'categories'
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE', // Se una categoria viene cancellata, le sue associazioni vengono rimosse
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });

        // Aggiungiamo un indice univoco sulla coppia di chiavi esterne.
        // Questo è fondamentale per impedire che un prodotto venga inserito
        // nella stessa categoria più di una volta.
        await queryInterface.addIndex(
            'product_categories',
            ['product_id', 'category_id'],
            {
                unique: true,
                name: 'product_category_unique_idx',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        // Quando si esegue il down, l'indice viene rimosso automaticamente
        // insieme alla tabella, quindi basta un solo comando.
        await queryInterface.dropTable('product_categories');
    },
};