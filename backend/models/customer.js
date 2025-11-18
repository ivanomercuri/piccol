'use strict';

module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    'Customer',
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      current_token: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'customers',
      timestamps: true,
    }
  );

  return Customer;
};
