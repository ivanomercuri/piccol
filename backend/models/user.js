module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
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
    },
    {
      tableName: 'users',
      timestamps: true,
    }
  );

  return User;
};
