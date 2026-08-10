import {
  Model,
  Sequelize,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';

// Tabella "through" per la relazione N:N tra Product e Category: nessun
// associate() qui, le due belongsToMany che la referenziano (in product.ts e
// category.ts) bastano perché Sequelize gestisca i join.
class ProductCategory extends Model<
  InferAttributes<ProductCategory>,
  InferCreationAttributes<ProductCategory>
> {
  declare id: CreationOptional<number>;

  declare product_id: number;

  declare category_id: number;

  declare readonly createdAt: CreationOptional<Date>;

  declare readonly updatedAt: CreationOptional<Date>;
}

module.exports = (
  sequelize: Sequelize,
  DataTypes: typeof import('sequelize').DataTypes
) => {
  ProductCategory.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      createdAt: DataTypes.DATE,

      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'product_categories',
      timestamps: true,
      indexes: [
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