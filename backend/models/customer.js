'use strict';

// Export the Customer model definition
module.exports = (sequelize, DataTypes) => {
  // Define the Customer model schema
  const Customer = sequelize.define('Customer', {
    // Customer email (must be unique and valid)
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    // Hashed password
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Token for current session (optional)
    current_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Customer first name
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Customer last name
    lastName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Customer address (optional)
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    // Table configuration
    tableName: 'customers',
    timestamps: true
  });

  // Return the Customer model
  return Customer;
};

