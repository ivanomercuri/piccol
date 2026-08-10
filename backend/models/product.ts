import {
  Model,
  Sequelize,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';

class Product extends Model<
  InferAttributes<Product>,
  InferCreationAttributes<Product>
> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare description: CreationOptional<string | null>;

  // DECIMAL: Sequelize (con mysql2) lo restituisce come STRINGA, non come
  // number, per non perdere precisione in virgola mobile — non è
  // un'assunzione, è il comportamento realmente osservato con questo
  // driver/dialetto. Tipizzarlo `number` sarebbe comodo da leggere ma
  // scorretto: qualunque codice futuro che farà aritmetica su `price` dovrà
  // convertirlo esplicitamente (es. `Number(product.price)` o una libreria
  // decimale), non potrà sommarlo/moltiplicarlo direttamente.
  declare price: string;

  declare quantity: CreationOptional<number>;

  declare available: CreationOptional<boolean>;

  declare sku: CreationOptional<string | null>;

  declare createdBy: number;

  declare readonly createdAt: CreationOptional<Date>;

  declare readonly updatedAt: CreationOptional<Date>;

  // Nota: le proprietà di accesso alle associazioni caricate via `include`
  // (es. `product.images`, `product.categories`, `product.creator`) non
  // sono dichiarate qui — richiederebbero importare i tipi degli altri
  // modelli, che al momento sono anch'essi in fase di conversione e
  // referenziati solo dinamicamente tramite `models/index.js` (non ancora
  // tipizzato). Il codice che consuma queste associazioni è ancora .js,
  // quindi non c'è al momento nessun impatto pratico; da rivalutare quando
  // anche i controller che usano `include` verranno convertiti (Fase 2.5).

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static associate(models: any) {
    Product.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator',
    });

    Product.hasMany(models.ProductImage, {
      foreignKey: 'product_id',
      as: 'images',
    });

    Product.belongsToMany(models.Category, {
      through: models.ProductCategory,
      foreignKey: 'product_id',
      otherKey: 'category_id',
      as: 'categories',
    });
  }
}

module.exports = (
  sequelize: Sequelize,
  DataTypes: typeof import('sequelize').DataTypes
) => {
  Product.init(
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

      available: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
      },

      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },

      createdAt: DataTypes.DATE,

      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'products',
      timestamps: true,
    }
  );

  return Product;
};