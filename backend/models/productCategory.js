'use strict';

// Modello per la tabella di join `product_categories`, creata dalla
// migrazione 20251204232401-create-product-categories-join-table.js. Serve
// solo come tabella "through" per la relazione N:N tra Product e Category
// (dichiarata nei rispettivi modelli con belongsToMany); non ha bisogno di
// un proprio metodo `associate`, dato che Sequelize gestisce già le join
// tramite le due belongsToMany che la referenziano.
module.exports = (sequelize, DataTypes) => {
  const ProductCategory = sequelize.define(
    'ProductCategory',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      // FK verso products.id, con onUpdate/onDelete CASCADE già impostati a
      // livello di DB dalla migrazione.
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      // FK verso categories.id, stesso comportamento CASCADE.
      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'product_categories',
      timestamps: true,
      // A differenza di Category e ProductImage, questa tabella NON ha una
      // colonna `deletedAt` (vedi la migrazione): niente `paranoid` qui, le
      // righe vengono cancellate fisicamente, coerentemente con il fatto che
      // rappresentano solo un'associazione, non un'entità con vita propria.
      indexes: [
        // Rispecchia l'indice univoco creato esplicitamente dalla
        // migrazione (product_category_unique_idx): impedisce che lo stesso
        // prodotto venga associato più volte alla stessa categoria.
        {
          unique: true,
          fields: ['product_id', 'category_id'],
          name: 'product_category_unique_idx',
        },
      ],
    }
  );

  return ProductCategory;
};