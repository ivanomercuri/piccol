// models/user.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
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
    password: { // Aggiungi questa parte
      type: DataTypes.STRING,
      allowNull: false,
    }
  }, {
    tableName: 'users',
    timestamps: true,
  });

  return User;
};
