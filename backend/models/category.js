'use strict';

// Modello per la tabella `categories`, creata dalla migrazione
// 20251204230730-create-categories-table.js ma finora priva di un modello
// Sequelize corrispondente (models/index.js carica automaticamente ogni file
// *.js in questa cartella, quindi basta aggiungerlo qui perché venga
// riconosciuto).
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    'Category',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      // La migrazione impone `unique: true` a livello di DB: lo dichiariamo
      // anche qui perché Sequelize lo sappia e possa restituire un errore di
      // validazione coerente invece di lasciar propagare solo l'errore SQL
      // grezzo del vincolo UNIQUE.
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: 'categories',
      timestamps: true,
      // La migrazione crea anche la colonna `deletedAt`: è il segnale che
      // questa tabella è pensata per il soft delete di Sequelize (paranoid).
      // Con `paranoid: true`, `Category.destroy()` valorizza `deletedAt`
      // invece di cancellare fisicamente la riga, e le query normali
      // escludono automaticamente i record cancellati.
      paranoid: true,
    }
  );

  Category.associate = function (models) {
    // Relazione N:N con Product tramite la tabella di join
    // `product_categories` (creata da
    // 20251204232401-create-product-categories-join-table.js), che ha anche
    // un indice univoco su (product_id, category_id) per impedire che lo
    // stesso prodotto venga associato due volte alla stessa categoria.
    Category.belongsToMany(models.Product, {
      through: models.ProductCategory,
      foreignKey: 'category_id',
      otherKey: 'product_id',
      as: 'products',
    });
  };

  return Category;
};