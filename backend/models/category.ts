import {
  Model,
  Sequelize,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';

class Category extends Model<
  InferAttributes<Category>,
  InferCreationAttributes<Category>
> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare readonly createdAt: CreationOptional<Date>;

  declare readonly updatedAt: CreationOptional<Date>;

  declare readonly deletedAt: CreationOptional<Date | null>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static associate(models: any) {
    Category.belongsToMany(models.Product, {
      through: models.ProductCategory,
      foreignKey: 'category_id',
      otherKey: 'product_id',
      as: 'products',
    });
  }
}

module.exports = (
  sequelize: Sequelize,
  DataTypes: typeof import('sequelize').DataTypes
) => {
  Category.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      createdAt: DataTypes.DATE,

      updatedAt: DataTypes.DATE,

      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'categories',
      timestamps: true,
      paranoid: true,
    }
  );

  return Category;
};