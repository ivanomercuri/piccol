'use strict';

// Modello per la tabella `product_images`, creata dalla migrazione
// 20251204231147-create-product-images-table.js. Rappresenta le singole
// immagini associate a un prodotto (relazione 1:N — un prodotto può avere più
// immagini, ognuna con il proprio ordine di visualizzazione).
module.exports = (sequelize, DataTypes) => {
  const ProductImage = sequelize.define(
    'ProductImage',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      // FK verso products.id. La migrazione imposta `onDelete: 'CASCADE'` a
      // livello di DB (cancellando un prodotto vengono cancellate anche le
      // sue immagini): non serve ripeterlo qui, la constraint vive nel DB.
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      image_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Determina l'ordine di visualizzazione delle immagini di uno stesso
      // prodotto (0 = prima immagine, valori crescenti a seguire).
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'product_images',
      timestamps: true,
      // Come per Category, la presenza di `deletedAt` nella migrazione
      // indica soft delete: con `paranoid: true` cancellare un'immagine non
      // rimuove la riga ma valorizza `deletedAt`.
      paranoid: true,
    }
  );

  ProductImage.associate = function (models) {
    ProductImage.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });
  };

  return ProductImage;
};