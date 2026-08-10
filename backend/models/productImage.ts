import {
  Model,
  Sequelize,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';

class ProductImage extends Model<
  InferAttributes<ProductImage>,
  InferCreationAttributes<ProductImage>
> {
  declare id: CreationOptional<number>;

  declare product_id: number;

  declare image_url: string;

  declare sort_order: CreationOptional<number>;

  declare readonly createdAt: CreationOptional<Date>;

  declare readonly updatedAt: CreationOptional<Date>;

  // paranoid: true (vedi sotto): soft delete, la colonna esiste sempre ma è
  // null finché il record non viene "cancellato". Opzionale in creazione,
  // come tutti i timestamp gestiti da Sequelize.
  declare readonly deletedAt: CreationOptional<Date | null>;

  // Il parametro `models` resta `any` per ora: models/index.js (il loader)
  // non è ancora tipizzato, quindi non esiste ancora un tipo reale da dargli
  // — verrà rivisto quando arriveremo a convertire index.js (ultimo file di
  // questa fase, vedi CHECKPOINT.md).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static associate(models: any) {
    ProductImage.belongsTo(models.Product, {
      foreignKey: 'product_id',
      as: 'product',
    });
  }
}

module.exports = (
  sequelize: Sequelize,
  DataTypes: typeof import('sequelize').DataTypes
) => {
  ProductImage.init(
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

      image_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      createdAt: DataTypes.DATE,

      updatedAt: DataTypes.DATE,

      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'product_images',
      timestamps: true,
      paranoid: true,
    }
  );

  return ProductImage;
};