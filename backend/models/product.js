'use strict';

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    'Product',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // image_url è stato rimosso: la migrazione
      // 20251204231312-delete-image_url-from-products.js ha già eliminato
      // questa colonna dalla tabella `products` nel DB, perché la gestione
      // delle immagini prodotto è stata spostata sulla tabella separata
      // `product_images` (creata da 20251204231147-create-product-images-table.js).
      // Tenerla ancora dichiarata qui faceva sì che qualsiasi query Sequelize
      // su Product (es. GET /products) fallisse con "Unknown column
      // 'image_url' in field list", perché Sequelize costruiva sempre una
      // SELECT includendo questo campo.
      available: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      // sku era invece il caso opposto: la colonna esiste nel DB dalla
      // migrazione 20251204225823-add-sku-to-products.js (STRING(100),
      // unique, nullable), ma non era mai stata dichiarata qui nel modello —
      // quindi non veniva mai letta/scritta né esposta nelle risposte API.
      sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: 'products',
      timestamps: true,
    }
  );

  Product.associate = function (models) {
    Product.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator',
    });
  };

  return Product;
};
