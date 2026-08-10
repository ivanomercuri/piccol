import {
  Model,
  Sequelize,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from 'sequelize';

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare email: string;

  // ENUM con defaultValue: opzionale in creazione, ma il valore reale è
  // sempre uno dei due letterali (mai una stringa arbitraria) — l'unione
  // letterale riflette esattamente il vincolo già imposto dall'ENUM del DB.
  declare level: CreationOptional<'admin' | 'superadmin'>;

  declare password: string;

  declare current_token: CreationOptional<string | null>;

  declare readonly createdAt: CreationOptional<Date>;

  declare readonly updatedAt: CreationOptional<Date>;
}

module.exports = (
  sequelize: Sequelize,
  DataTypes: typeof import('sequelize').DataTypes
) => {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      level: {
        type: DataTypes.ENUM('superadmin', 'admin'),
        allowNull: false,
        defaultValue: 'admin',
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      current_token: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      },

      createdAt: DataTypes.DATE,

      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'users',
      timestamps: true,
    }
  );

  return User;
};